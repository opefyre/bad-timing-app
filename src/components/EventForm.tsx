'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EventInput, EventKind, VenueInput } from '@/types';

type LocationSuggestion = VenueInput & { id: string; label: string; lat: number; lng: number };
type TvSuggestion = { id: number; name: string; detail?: string };

const EVENT_KINDS: Array<{ value: EventKind; label: string; hint: string }> = [
  { value: 'birthday', label: 'BIRTHDAY', hint: 'friends + plans' },
  { value: 'dinner', label: 'DINNER', hint: 'table + travel' },
  { value: 'meetup', label: 'MEETUP', hint: 'community' },
  { value: 'workshop', label: 'WORKSHOP', hint: 'focused time' },
  { value: 'outdoor_activity', label: 'OUTDOOR', hint: 'weather + light' },
  { value: 'screening', label: 'SCREENING', hint: 'match / TV' },
  { value: 'other', label: 'OTHER', hint: 'something else' },
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

  function pickLocation(item: LocationSuggestion) {
    setVenue({
      address: item.label,
      name: item.name,
      lat: item.lat,
      lng: item.lng,
      timezone: item.timezone,
      countryCode: item.countryCode,
      state: item.state,
      city: item.city,
    });
    setLocationQuery(item.label);
    if (item.name && !venueName) setVenueName(item.name);
    setLocationOpen(false);
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
        <div className="step-tag">01 / WHERE</div>
        <div className="field-stack" ref={locationBox}>
          <label className="field-label" htmlFor="location">LOCATION</label>
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
              placeholder="Type a venue, address or city"
              autoComplete="off"
              required
            />
            <span className={`input-status ${locationBusy ? 'blink' : ''}`}>{locationBusy ? '...' : venue?.timezone ? 'OK' : '>>'}</span>
          </div>
          {locationOpen && locations.length > 0 && (
            <div className="pixel-popover" role="listbox" aria-label="Location suggestions">
              {locations.map((item) => (
                <button type="button" className="popover-option" key={item.id} onClick={() => pickLocation(item)}>
                  <span>{item.label}</span>
                  <small>{item.timezone || 'timezone will be resolved'}</small>
                </button>
              ))}
            </div>
          )}
          <p className="microcopy">LOCATION MATCHING BY <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">GEOAPIFY</a>. THE EVENT TIME IS INTERPRETED IN THE VENUE&apos;S TIMEZONE.</p>
        </div>

        <div className="form-grid two">
          <div className="field-stack">
            <label className="field-label" htmlFor="venue-name">VENUE NAME <span>OPTIONAL</span></label>
            <input id="venue-name" className="pixel-input" value={venueName} onChange={(event) => setVenueName(event.target.value)} placeholder="e.g. Barbican Centre" />
          </div>
          <div className="field-stack">
            <label className="field-label">INDOOR / OUTDOOR</label>
            <div className="pixel-segment" role="group" aria-label="Indoor or outdoor">
              <button type="button" className={!isOutdoor ? 'active' : ''} onClick={() => setIsOutdoor(false)}>INDOOR</button>
              <button type="button" className={isOutdoor ? 'active' : ''} onClick={() => setIsOutdoor(true)}>OUTDOOR</button>
            </div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <div className="step-tag">02 / WHAT</div>
        <label className="field-label">EVENT TYPE</label>
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
              <strong>{kind.label}</strong>
              <span>{kind.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="form-section">
        <div className="step-tag">03 / WHEN</div>
        <div className="form-grid two">
          <div className="field-stack">
            <label className="field-label" htmlFor="date-time">START</label>
            <input id="date-time" type="datetime-local" className="pixel-input" value={dateTime} onChange={(event) => setDateTime(event.target.value)} required />
          </div>
          <div className="field-stack">
            <label className="field-label" htmlFor="duration">DURATION</label>
            <select id="duration" className="pixel-input" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
              {[30, 45, 60, 90, 120, 150, 180, 240, 360].map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} MIN` : `${minutes / 60} ${minutes === 60 ? 'HOUR' : 'HOURS'}`}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="form-section optional-zone">
        <div className="step-tag">04 / YOUR CROWD <span>OPTIONAL</span></div>
        <p className="section-copy">Only add things your group actually cares about. We do not guess private preferences.</p>
        <div className="form-grid two">
          <div className="field-stack">
            <label className="field-label" htmlFor="football">FOOTBALL TEAM</label>
            <input id="football" className="pixel-input" value={footballTeam} onChange={(event) => setFootballTeam(event.target.value)} placeholder="e.g. Arsenal" />
          </div>
          <div className="field-stack" ref={tvBox}>
            <label className="field-label" htmlFor="programme">TV PROGRAMME</label>
            <div className="input-shell">
              <input
                id="programme"
                className="pixel-input"
                value={programmeName}
                onChange={(event) => { setProgrammeName(event.target.value); setProgrammeId(undefined); }}
                onFocus={() => tvResults.length > 0 && setTvOpen(true)}
                placeholder="e.g. The Great British Bake Off"
                autoComplete="off"
              />
              <span className={`input-status small ${tvBusy ? 'blink' : ''}`}>{programmeId ? 'OK' : tvBusy ? '...' : ''}</span>
            </div>
            {tvOpen && tvResults.length > 0 && (
              <div className="pixel-popover compact" role="listbox" aria-label="TV programme suggestions">
                {tvResults.map((item) => (
                  <button type="button" className="popover-option" key={item.id} onClick={() => pickProgramme(item)}>
                    <span>{item.name}</span><small>{item.detail}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <button className="pixel-cta" type="submit" disabled={!canSubmit || isLoading}>
        <span className="cta-pixels" aria-hidden="true"><i /><i /><i /></span>
        {isLoading ? 'CHECKING THE OUTSIDE WORLD...' : 'CHECK THIS DATE'}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
