'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DurationPicker from '@/components/DurationPicker';
import LocationMap from '@/components/LocationMap';
import StartPicker from '@/components/StartPicker';
import { EventInput, EventKind, FootballTeam, VenueInput } from '@/types';

type LocationSuggestion = VenueInput & { id: string; label: string; lat: number; lng: number };
type TvSuggestion = { id: number; name: string; detail?: string };
type FootballSuggestion = { id: number; name: string; detail?: string };

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
  const [radiusKm,setRadiusKm]=useState(initialData?.radiusKm??3);
  const [includeNews,setIncludeNews]=useState(initialData?.includeNews??false);
  const [needsInternet,setNeedsInternet]=useState(initialData?.needsInternet??false);
  const [footballTeams, setFootballTeams] = useState<FootballTeam[]>(initialData?.footballTeams ?? []);
  const [footballQuery, setFootballQuery] = useState('');
  const [footballResults, setFootballResults] = useState<FootballSuggestion[]>([]);
  const [footballOpen, setFootballOpen] = useState(false);
  const [footballBusy, setFootballBusy] = useState(false);
  const footballBox = useRef<HTMLDivElement>(null);

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
      if (footballBox.current && !footballBox.current.contains(event.target as Node)) setFootballOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 3 || (venue?.address === query && typeof venue.lat === 'number')) return;
    const controller=new AbortController();
    const timer = window.setTimeout(async () => {
      setLocationBusy(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`,{signal:controller.signal});
        const data = await response.json();
        if(controller.signal.aborted)return;
        if (!response.ok) throw new Error('Location search failed');
        setLocations(data.suggestions ?? []);
        setLocationOpen(true);
      } catch {
        setLocations([]);
      } finally {
        setLocationBusy(false);
      }
    }, 280);
    return () => {window.clearTimeout(timer);controller.abort();};
  }, [locationQuery, venue]);

  useEffect(() => {
    const query = programmeName.trim();
    if (query.length < 2 || programmeId) return;
    const controller=new AbortController();
    const timer = window.setTimeout(async () => {
      setTvBusy(true);
      try {
        const response = await fetch(`/api/tv-search?q=${encodeURIComponent(query)}`,{signal:controller.signal});
        const data = await response.json();
        if(controller.signal.aborted)return;
        if (!response.ok) throw new Error('TV search failed');
        setTvResults(data.shows ?? []);
        setTvOpen(true);
      } catch {
        setTvResults([]);
      } finally {
        setTvBusy(false);
      }
    }, 280);
    return () => {window.clearTimeout(timer);controller.abort();};
  }, [programmeName, programmeId]);

  useEffect(() => {
    const query = footballQuery.trim();
    if (query.length < 2) return;
    const controller=new AbortController();
    const timer = window.setTimeout(async () => {
      setFootballBusy(true);
      try {
        const response = await fetch(`/api/football-search?q=${encodeURIComponent(query)}`,{signal:controller.signal});
        const data = await response.json();
        if(controller.signal.aborted)return;
        if (!response.ok) throw new Error('Team search failed');
        setFootballResults((data.teams ?? []).map((team: FootballSuggestion) => ({ id: team.id, name: team.name, detail: team.detail })));
        setFootballOpen(true);
      } catch {
        setFootballResults([]);
      } finally {
        setFootballBusy(false);
      }
    }, 280);
    return () => {window.clearTimeout(timer);controller.abort();};
  }, [footballQuery]);

  const canSubmit = useMemo(() => locationQuery.trim().length >= 3 && Boolean(dateTime) && duration >= 15 && (!programmeName.trim()||!!programmeId), [locationQuery, dateTime, duration,programmeName,programmeId]);

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
      subdivisionCode:item.subdivisionCode,countryName:item.countryName,
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

  function addFootballTeam(item: FootballSuggestion) {
    setFootballTeams((current) => current.some((team) => team.id === item.id) ? current : [...current, { id: item.id, name: item.name }]);
    setFootballQuery('');
    setFootballResults([]);
    setFootballOpen(false);
  }

  function removeFootballTeam(id: number) {
    setFootballTeams((current) => current.filter((team) => team.id !== id));
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
      footballTeams: footballTeams.length ? footballTeams : undefined,
      programmeName: programmeName.trim() || undefined,
      programmeId,radiusKm,includeNews,needsInternet,
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
          <div className="field-stack" ref={footballBox}>
            <div className="field-label-row">
              <label className="field-label" htmlFor="football">Football teams <span>optional</span></label>
              {footballBusy && <span className="field-state">Searching…</span>}
            </div>
            <input
              id="football"
              className="pixel-input"
              role="combobox"
              aria-expanded={footballOpen && footballResults.length > 0}
              aria-controls="football-suggestions"
              aria-autocomplete="list"
              value={footballQuery}
              onChange={(event) => setFootballQuery(event.target.value)}
              onFocus={() => footballResults.length > 0 && setFootballOpen(true)}
              placeholder={footballTeams.length ? 'Add another team…' : 'Search teams'}
              autoComplete="off"
            />
            {footballOpen && footballResults.length > 0 && (
              <div className="pixel-popover compact" id="football-suggestions" role="listbox" aria-multiselectable="true" aria-label="Football team suggestions">
                {footballResults.map((item) => (
                  <button type="button" className="popover-option" key={item.id} onClick={() => addFootballTeam(item)}>
                    <span>{item.name}</span>{item.detail && <small>{item.detail}</small>}
                  </button>
                ))}
              </div>
            )}
            {footballTeams.length > 0 && (
              <div className="team-chips" role="list" aria-label="Selected football teams">
                {footballTeams.map((team) => (
                  <button key={team.id} type="button" className="team-chip" onClick={() => removeFootballTeam(team.id)} aria-label={`Remove ${team.name}`}>
                    <span>{team.name}</span><span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
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

      <section className="form-section optional-zone">
        <div className="section-title">Around the venue</div>
        <div className="radius-buttons" role="group" aria-label="Nearby search radius">{[1,3,5,10].map(km=><button type="button" key={km} aria-pressed={radiusKm===km} className={`pixel-button ${radiusKm===km?'accent':''}`} onClick={()=>setRadiusKm(km)}>{km} km</button>)}</div>
        <label className="check-option"><input type="checkbox" checked={includeNews} onChange={e=>setIncludeNews(e.target.checked)}/><span>Include recent local news</span></label>
        <label className="check-option"><input type="checkbox" checked={needsInternet} onChange={e=>setNeedsInternet(e.target.checked)}/><span>This event needs internet</span></label>
      </section>
      {programmeName.trim()&&!programmeId&&<p className="field-message">Choose a programme from the results, or clear the field.</p>}
      <button className="pixel-cta" type="submit" disabled={!canSubmit || isLoading}>
        {isLoading ? 'Checking…' : 'Check this date'}<span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
