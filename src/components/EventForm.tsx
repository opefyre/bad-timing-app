'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { EventInput } from '@/types';

const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full flex items-center justify-center" style={{ height: '240px', background: 'var(--paper-dark)', borderRadius: '2px', border: '2px dashed var(--ink-faint)' }}>
      <span className="text-sm" style={{ color: 'var(--ink-faint)' }}>laying the map out…</span>
    </div>
  ),
});

interface Suggestion {
  id: string;
  label: string;
  name?: string;
  lat: number;
  lng: number;
}

interface Selected {
  label: string;
  lat: number;
  lng: number;
}

interface EventFormProps {
  onSubmit: (input: EventInput) => void;
  isLoading: boolean;
}

export default function EventForm({ onSubmit, isLoading }: EventFormProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Selected | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [isOutdoor, setIsOutdoor] = useState(true);
  const [footballTeam, setFootballTeam] = useState('');
  const [programmeName, setProgrammeName] = useState('');
  const [showOptional, setShowOptional] = useState(false);

  const boxRef = useRef<HTMLDivElement>(null);
  const reverseToken = useRef(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || (selected && selected.label === q)) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error('search failed');
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
        setHighlight(-1);
        setSearchError(false);
      } catch {
        setSuggestions([]);
        setSearchError(true);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selected]);

  const select = (s: Suggestion) => {
    setSelected({ label: s.label, lat: s.lat, lng: s.lng });
    setQuery(s.label);
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
    if (s.name && !venueName) setVenueName(s.name);
  };

  const handlePlace = async (lat: number, lng: number) => {
    const token = ++reverseToken.current;
    setResolving(true);
    const fallback = `Pin at ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const set = (label: string, name?: string) => {
      if (token !== reverseToken.current) return;
      setSelected({ label, lat, lng });
      setQuery(label);
      if (name && !venueName) setVenueName(name);
    };
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (res.ok && data.formatted) set(data.formatted, data.name);
      else set(fallback);
    } catch {
      set(fallback);
    } finally {
      if (token === reverseToken.current) setResolving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && suggestions[highlight]) {
        e.preventDefault();
        select(suggestions[highlight]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      venue: {
        address: selected ? selected.label : query.trim(),
        lat: selected?.lat,
        lng: selected?.lng,
        name: venueName || undefined,
      },
      dateTime,
      durationMinutes: duration,
      isOutdoor,
      footballTeam: footballTeam || undefined,
      programmeName: programmeName || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div ref={boxRef} className="relative">
        <label htmlFor="location-query" className="block mb-1 font-bold text-sm" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
          Where?
        </label>

        <div className="relative">
          <input
            id="location-query"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selected) setSelected(null);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Search for a place, or drop the pin on the map below"
            className="paper-input"
            style={{ paddingRight: '2.25rem' }}
            autoComplete="off"
            aria-autocomplete="list"
            required
          />
          {searching && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" role="status" aria-label="Searching">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--ink-faint)" strokeWidth="3" opacity="0.35" />
                <path d="M22 12a10 10 0 0 0-10-10" stroke="var(--berry)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          )}
        </div>

        {open && suggestions.length > 0 && (
          <ul
            className="absolute left-0 right-0 mt-2 max-h-72 overflow-y-auto"
            style={{ background: 'var(--paper-light)', border: '2px solid var(--ink)', boxShadow: '5px 5px 0 var(--shadow-1)', borderRadius: '4px', zIndex: 1100 }}
          >
            {suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(s)}
                  onMouseEnter={() => setHighlight(i)}
                  className="w-full block text-left px-3 py-2 text-sm cursor-pointer"
                  style={{ background: i === highlight ? 'var(--paper-dark)' : 'transparent', color: 'var(--ink)' }}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {open && searchError && !searching && (
          <p className="text-xs mt-1" style={{ color: 'var(--berry)' }}>Could not find that place — try a fuller address or drop the pin on the map.</p>
        )}

        <div className="mt-3 relative" style={{ border: '2px solid var(--ink)', boxShadow: '5px 5px 0 var(--shadow-1)', borderRadius: '4px', background: 'var(--paper-dark)' }}>
          <LocationMap lat={selected?.lat} lng={selected?.lng} onPlace={handlePlace} />
          <span className="paper-label absolute top-2 left-2 pointer-events-none" style={{ background: 'var(--ink)' }}>{selected ? 'Pinned' : 'Map'}</span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs" style={{ color: resolving ? 'var(--ink-faint)' : 'var(--ink-soft)' }}>
            {resolving ? 'Reading the address…' : 'Drag the pin to adjust · click to drop'}
          </p>
          {selected && (
            <a
              href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs"
              style={{ color: 'var(--ink-soft)', textDecoration: 'underline' }}
            >
              Open in Google Maps ↗
            </a>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="venue-name" className="block mb-1 font-bold text-sm" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
          Venue name
        </label>
        <input
          id="venue-name"
          type="text"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          placeholder="e.g. The Royal Oak"
          className="paper-input"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block mb-1 font-bold text-sm" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            Date &amp; time
          </label>
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="paper-input"
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-bold text-sm" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            Duration (min)
          </label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 90)}
            min={15}
            max={480}
            className="paper-input"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOutdoor(!isOutdoor)}
        className="paper-btn w-full flex items-center justify-between !py-3"
      >
        <span className="font-bold">{isOutdoor ? 'Outside' : 'Indoors'}</span>
        <input
          type="checkbox"
          checked={isOutdoor}
          onChange={(e) => setIsOutdoor(e.target.checked)}
          className="paper-check"
          aria-label="Outdoor event"
        />
      </button>

      <button
        type="button"
        onClick={() => setShowOptional(!showOptional)}
        className="w-full text-left font-bold"
        style={{ color: 'var(--ink-soft)', letterSpacing: '0.04em' }}
      >
        {showOptional ? '−' : '+'} Optional preferences
      </button>

      {showOptional && (
        <div className="space-y-6 animate-in" style={{ borderLeft: '2px dashed var(--ink-faint)', paddingLeft: '1rem' }}>
          <div>
            <label className="block mb-1 font-bold text-sm" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              Football team
            </label>
            <input
              type="text"
              value={footballTeam}
              onChange={(e) => setFootballTeam(e.target.value)}
              placeholder="e.g. Arsenal"
              className="paper-input"
            />
          </div>
          <div>
            <label className="block mb-1 font-bold text-sm" style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              TV programme
            </label>
            <input
              type="text"
              value={programmeName}
              onChange={(e) => setProgrammeName(e.target.value)}
              placeholder="e.g. Match of the Day"
              className="paper-input"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="paper-btn paper-btn-accent w-full !py-4 text-lg"
      >
        {isLoading ? 'Cutting the report…' : 'Check for conflicts ✂'}
      </button>
    </form>
  );
}