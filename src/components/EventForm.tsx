'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DurationPicker from '@/components/DurationPicker';
import LocationMap from '@/components/LocationMap';
import StartPicker from '@/components/StartPicker';
import { EventInput, EventKind, VenueInput } from '@/types';

type LocationSuggestion = VenueInput & { id: string; label: string; lat: number; lng: number };
type TvSuggestion = { id: number; name: string; detail?: string };

const EVENT_KINDS: Array<{ value: EventKind; label: string }> = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'outdoor_activity', label: 'Outdoor activity' },
  { value: 'screening', label: 'Screening' },
  { value: 'other', label: 'Other' },
];

function defaultLocalDateTime() {
  const now = new Date(Date.now() + 24 * 60 * 60_000);
  now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

interface Props {
  onSubmit: (input: EventInput) => void;
  isLoading: boolean;
  initialData?: EventInput | null;
}

export default function EventForm({ onSubmit, isLoading, initialData }: Props) {
  const [locationQuery, setLocationQuery] = useState(initialData?.venue.address ?? '');
  const [venue, setVenue] = useState<VenueInput | null>(initialData?.venue ?? null);
  const [locations, setLocations] = useState<LocationSuggestion[]>([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const locationBox = useRef<HTMLDivElement>(null);

  const [eventKind, setEventKind] = useState<EventKind>(initialData?.eventKind ?? 'meetup');
  const [dateTime, setDateTime] = useState(initialData?.dateTime ?? defaultLocalDateTime());
  const [duration, setDuration] = useState(initialData?.durationMinutes ?? 90);
  const [isOutdoor, setIsOutdoor] = useState(initialData?.isOutdoor ?? false);
  const [venueName, setVenueName] = useState(initialData?.venue.name ?? '');
  const [footballTeam, setFootballTeam] = useState(initialData?.footballTeam ?? '');

  const [programmeName, setProgrammeName] = useState(initialData?.programmeName ?? '');
  const [programmeId, setProgrammeId] = useState<number | undefined>(initialData?.programmeId);
  const [tvResults, setTvResults] = useState<TvSuggestion[]>([]);
  const [tvOpen, setTvOpen] = useState(false);
  const [tvBusy, setTvBusy] = useState(false);
  const tvBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (locationBox.current && !locationBox.current.contains(event.target as Node)) setLocationOpen(false);
      if (tvBox.current && !tvBox.current.contains(event.target as Node)) setTvOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 3 || (venue?.address === query && typeof venue.lat === 'number')) return;
    const timer = window.setTimeout(async () => {
      setLocationBusy(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!response.ok) throw new Error('Location search failed');
        setLocations(data.suggestions ?? []);
        setLocationOpen(true);
      } catch {
        setLocations([]);
      } finally {
        setLocationBusy(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [locationQuery, venue]);

  useEffect(() => {
    const query = programmeName.trim();
    if (query.length < 2 || programmeId) return;
    const timer = window.setTimeout(async () => {
      setTvBusy(true);
      try {
        const response = await fetch(`/api/tv-search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!response.ok) throw new Error('TV search failed');
        setTvResults(data.shows ?? []);
        setTvOpen(true);
      } catch {
        setTvResults([]);
      } finally {
        setTvBusy(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [programmeName, programmeId]);

  const canSubmit = useMemo(() => locationQuery.trim().length >= 3 && Boolean(dateTime) && duration >= 15, [locationQuery, dateTime, duration]);

  function setPickedVenue(item: VenueInput, label = item.address) {
    setVenue(item);
    setLocationQuery(label);
    if (item.name && !venueName) setVenueName(item.name);
    setLocationOpen(false);
    setMapMessage(null);
  }

  function pickLocation(item: LocationSuggestion) {
    setPickedVenue({
      address: item.label,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      timezone: item.timezone,
      countryCode: item.countryCode,
      state: item.state,
      city: item.city,
    }, item.label);
  }

  async function pickCoordinates(lat: number, lng: number) {
    setLocationBusy(true);
    setMapMessage(null);
    try {
      const response = await fetch(`/api/geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`);
      const data = await response.json();
      if (!response.ok || !data.location) throw new Error('Could not identify this point');
      setPickedVenue(data.location, data.location.address);
    } catch {
      const address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setVenue({ address, lat, lng });
      setLocationQuery(address);
      setMapMessage('Pin selected. The address could not be resolved.');
    } finally {
      setLocationBusy(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMapMessage('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    setMapMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        void pickCoordinates(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocating(false);
        setMapMessage('Location permission was not granted.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  function pickProgramme(item: TvSuggestion) {
    setProgrammeName(item.name);
    setProgrammeId(item.id);
    setTvOpen(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || isLoading) return;
    onSubmit({
      venue: {
        ...(venue ?? { address: locationQuery.trim() }),
        address: venue?.address === locationQuery ? venue.address : locationQuery.trim(),
        name: venueName.trim() || undefined,
      },
      dateTime,
      durationMinutes: duration,
      eventKind,
      isOutdoor,
      footballTeam: footballTeam.trim() || undefined,
      programmeName: programmeName.trim() || undefined,
      programmeId,
    });
  }

  return (
    <form className="pixel-form" onSubmit={submit}>
      <section className="form-section">
        <div className="section-title">Where?</div>
        <div className="field-stack" ref={locationBox}>
          <div className="field-label-row">
            <label className="field-label" htmlFor="location">Location</label>
            {locationBusy && <span className="field-state">Searching…</span>}
          </div>
          <div className="input-shell">
            <input
              id="location"
              className="pixel-input input-big"
              value={locationQuery}
              onChange={(event) => {
                setLocationQuery(event.target.value);
                if (venue?.address !== event.target.value) setVenue(null);
              }}
              onFocus={() => locations.length > 0 && setLocationOpen(true)}
              autoComplete="off"
              required
            />
          </div>
          {locationOpen && locations.length > 0 && (
            <div className="pixel-popover location-results" role="listbox" aria-label="Location suggestions">
              {locations.map((item) => (
                <button type="button" className="popover-option" key={item.id} onClick={() => pickLocation(item)}>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
          <LocationMap venue={venue} onPick={(lat, lng) => void pickCoordinates(lat, lng)} onLocate={useMyLocation} locating={locating} />
          {mapMessage && <p className="field-message">{mapMessage}</p>}
        </div>

        <div className="form-grid two">
          <div className="field-stack">
            <label className="field-label" htmlFor="venue-name">Venue name <span>optional</span></label>
            <input id="venue-name" className="pixel-input" value={venueName} onChange={(event) => setVenueName(event.target.value)} />
          </div>
          <div className="field-stack">
            <label className="field-label">Setting</label>
            <div className="pixel-segment equal-height" role="group" aria-label="Indoor or outdoor">
              <button type="button" className={!isOutdoor ? 'active' : ''} onClick={() => setIsOutdoor(false)}>Indoor</button>
              <button type="button" className={isOutdoor ? 'active' : ''} onClick={() => setIsOutdoor(true)}>Outdoor</button>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="section-title">What?</div>
        <div className="kind-grid">
          {EVENT_KINDS.map((kind) => (
            <button
              type="button"
              key={kind.value}
              className={`kind-tile ${eventKind === kind.value ? 'active' : ''}`}
              onClick={() => {
                setEventKind(kind.value);
                if (kind.value === 'outdoor_activity') setIsOutdoor(true);
              }}
            >
              {kind.label}
            </button>
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="section-title">When?</div>
        <div className="form-grid two no-top-margin">
          <div className="field-stack">
            <label className="field-label">Start</label>
            <StartPicker value={dateTime} onChange={setDateTime} />
          </div>
          <div className="field-stack">
            <label className="field-label">Duration</label>
            <DurationPicker value={duration} onChange={setDuration} />
          </div>
        </div>
      </section>

      <section className="form-section optional-zone">
        <div className="section-title">Anything your group follows? <span>optional</span></div>
        <div className="form-grid two">
          <div className="field-stack">
            <label className="field-label" htmlFor="football">Football team</label>
            <input id="football" className="pixel-input" value={footballTeam} onChange={(event) => setFootballTeam(event.target.value)} />
          </div>
          <div className="field-stack" ref={tvBox}>
            <div className="field-label-row">
              <label className="field-label" htmlFor="programme">TV programme</label>
              {tvBusy && <span className="field-state">Searching…</span>}
            </div>
            <input
              id="programme"
              className="pixel-input"
              value={programmeName}
              onChange={(event) => { setProgrammeName(event.target.value); setProgrammeId(undefined); }}
              onFocus={() => tvResults.length > 0 && setTvOpen(true)}
              autoComplete="off"
            />
            {tvOpen && tvResults.length > 0 && (
              <div className="pixel-popover compact" role="listbox" aria-label="TV programme suggestions">
                {tvResults.map((item) => (
                  <button type="button" className="popover-option" key={item.id} onClick={() => pickProgramme(item)}>
                    <span>{item.name}</span>{item.detail && <small>{item.detail}</small>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <button className="pixel-cta" type="submit" disabled={!canSubmit || isLoading}>
        {isLoading ? 'Checking…' : 'Check this date'}<span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
