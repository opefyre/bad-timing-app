'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Logo from '@/components/Logo';
import { Conflict, EventPreference, PreferenceOverrides, Report, SourceStatus, Suggestion } from '@/types';
import { formatLocalDateTime } from '@/lib/time';

const TYPE_LABEL: Record<Conflict['type'], string> = {
  nearby_event: 'Nearby event',
  sport: 'Football',
  tv: 'TV',
  holiday: 'Holiday',
  weather: 'Weather',
  daylight: 'Daylight',
  transport: 'Transport',
};

const PREFS: Array<{ value: EventPreference; label: string }> = [
  { value: 'avoid', label: 'Avoid it' },
  { value: 'neutral', label: "Doesn't matter" },
  { value: 'plan_around', label: 'Plan around it' },
];

const SOURCE_NAME: Record<string, string> = {
  geoapify: 'Geoapify',
  ticketmaster: 'Ticketmaster',
  football: 'football-data.org',
  tvmaze: 'TVmaze',
  'bank-holidays': 'UK bank holidays',
  weather: 'MET Norway',
  daylight: 'Sunrise-Sunset',
  tfl: 'TfL',
};

interface Props {
  report: Report;
  preferences: PreferenceOverrides;
  recommendationBusy: boolean;
  recommendationDirty: boolean;
  onPreference: (id: string, preference: EventPreference) => void;
  onRecalculate: () => void;
  onApply: (suggestion: Suggestion) => void;
  onEdit: () => void;
  onRerun: () => void;
}

function effectivePreference(conflict: Conflict, preferences: PreferenceOverrides) {
  return preferences[conflict.id] ?? conflict.preference;
}

function sourceState(source: SourceStatus) {
  if (source.state === 'checked') return 'Checked';
  if (source.state === 'out_of_range') return 'Outside current coverage';
  if (source.state === 'unavailable') return 'Unavailable';
  if (source.id === 'football') return 'No team selected';
  if (source.id === 'tvmaze') return 'No programme selected';
  if (source.id === 'bank-holidays') return 'UK only';
  if (source.id === 'tfl') return 'London only';
  if (source.id === 'daylight') return 'Outdoor events only';
  return 'Not needed';
}

function FindingCard({ conflict, preference, onChange }: { conflict: Conflict; preference: EventPreference; onChange: (value: EventPreference) => void }) {
  return (
    <article className={`finding-card impact-${conflict.impact}`}>
      <div className="finding-body">
        <div className="finding-kicker">{TYPE_LABEL[conflict.type]}</div>
        <h3>{conflict.title}</h3>
        <p>{conflict.description}</p>
        <div className="finding-meta">
          {typeof conflict.distanceKm === 'number' && <span>{conflict.distanceKm.toFixed(1)} km away</span>}
          {conflict.sourceUrl ? <a href={conflict.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a> : <span>{conflict.source}</span>}
        </div>
      </div>
      <div className="intent-control" aria-label={`How to treat ${conflict.title}`}>
        {PREFS.map((item) => (
          <button key={item.value} type="button" className={preference === item.value ? `active ${item.value}` : ''} onClick={() => onChange(item.value)}>
            {item.label}
          </button>
        ))}
      </div>
    </article>
  );
}

function SuggestionCard({ suggestion, primary, onApply }: { suggestion: Suggestion; primary?: boolean; onApply: () => void }) {
  return (
    <article className={`suggestion-card ${primary ? 'primary' : ''}`}>
      <div className="suggestion-head">
        <span>{primary ? 'Best small change' : suggestion.mode === 'earlier' ? 'Earlier' : 'Another day'}</span>
        <strong>{suggestion.avoidCount === 0 ? 'No conflicts left' : `${suggestion.avoidCount} left`}</strong>
      </div>
      <h3>{suggestion.change}</h3>
      <div className="suggestion-columns">
        {suggestion.conflictsResolved.length > 0 && <div><b>Fixes</b><p>{suggestion.conflictsResolved.join(' · ')}</p></div>}
        {suggestion.conflictsRemaining.length > 0 && <div><b>Still there</b><p>{suggestion.conflictsRemaining.join(' · ')}</p></div>}
        {suggestion.conflictsAdded.length > 0 && <div><b>New</b><p>{suggestion.conflictsAdded.join(' · ')}</p></div>}
        {suggestion.planAroundKept.length > 0 && <div><b>Keeps</b><p>{suggestion.planAroundKept.join(' · ')}</p></div>}
      </div>
      <button type="button" className="pixel-button invert" onClick={onApply}>Use this time</button>
    </article>
  );
}

export default function ReportView({ report, preferences, recommendationBusy, recommendationDirty, onPreference, onRecalculate, onApply, onEdit, onRerun }: Props) {
  const [showAll, setShowAll] = useState(false);
  const avoid = useMemo(() => report.conflicts.filter((c) => effectivePreference(c, preferences) === 'avoid'), [report.conflicts, preferences]);
  const planAround = useMemo(() => report.conflicts.filter((c) => effectivePreference(c, preferences) === 'plan_around'), [report.conflicts, preferences]);
  const visible = showAll ? report.conflicts : report.conflicts.slice(0, 3);
  const hasIncompleteCoverage = report.sources.some((source) => source.state === 'unavailable' || source.state === 'out_of_range');

  return (
    <div className="report-page">
      <header className="site-header report-topbar">
        <button type="button" className="brand-button brand" onClick={onEdit}><Logo size={30} /><strong>BAD TIMING</strong></button>
        <div className="report-actions">
          <Link className="plain-link" href="/data">Data & privacy</Link>
          <button type="button" className="pixel-button ghost" onClick={onRerun}>Check again</button>
          <button type="button" className="pixel-button" onClick={onEdit}>Edit</button>
        </div>
      </header>

      <main className="report-shell">
        <section className={`verdict-block ${avoid.length ? 'warn' : 'clear'}`}>
          <div className="verdict-code" aria-hidden="true">{avoid.length ? '!' : '✓'}</div>
          <div>
            <p className="report-context">{formatLocalDateTime(report.event.dateTime)} · {report.event.venue.name || report.event.venue.address}</p>
            <h1>{avoid.length ? `${avoid.length} ${avoid.length === 1 ? 'thing' : 'things'} to avoid` : hasIncompleteCoverage ? 'No conflict found in the sources checked' : 'Looks clear'}</h1>
            <p className="verdict-copy">{report.event.durationMinutes} min · {report.event.isOutdoor ? 'Outdoor' : 'Indoor'}{planAround.length ? ` · ${planAround.length} to plan around` : ''}</p>
          </div>
        </section>

        {report.coverageGaps.length > 0 && (
          <section className="coverage-warning">
            <strong>Couldn&apos;t fully check:</strong>
            <span>{report.coverageGaps.map((name) => SOURCE_NAME[report.sources.find((s) => s.name === name)?.id ?? ''] || name).join(', ')}</span>
          </section>
        )}

        <section className="report-section">
          <div className="section-heading">
            <h2>{report.conflicts.length ? 'Worth knowing' : 'Nothing obvious found'}</h2>
            {report.conflicts.length > 3 && <button type="button" className="text-button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show less' : `Show all ${report.conflicts.length}`}</button>}
          </div>
          {report.conflicts.length ? (
            <div className="findings-list">
              {visible.map((conflict) => (
                <FindingCard key={conflict.id} conflict={conflict} preference={effectivePreference(conflict, preferences)} onChange={(value) => onPreference(conflict.id, value)} />
              ))}
            </div>
          ) : (
            <div className="empty-pixel"><p>No relevant issue surfaced for this time and place.</p></div>
          )}
        </section>

        <section className="report-section recommendation-zone">
          <div className="section-heading">
            <h2>Try another time</h2>
            {recommendationDirty && !recommendationBusy && <button className="pixel-button accent" type="button" onClick={onRecalculate}>Recalculate</button>}
          </div>

          {recommendationBusy ? (
            <div className="recommendation-loading"><span className="scanner-line" /><strong>Checking alternatives…</strong></div>
          ) : avoid.length === 0 ? (
            <div className="no-change-card"><p>No change needed for the things you marked “Avoid it”.</p></div>
          ) : recommendationDirty ? (
            <div className="no-change-card"><p>Your choices changed. Recalculate to check new alternatives.</p></div>
          ) : report.suggestions.length > 0 ? (
            <div className="suggestion-stack">
              {report.suggestions.map((suggestion, index) => <SuggestionCard key={`${suggestion.mode}-${suggestion.newDateTime}`} suggestion={suggestion} primary={index === 0} onApply={() => onApply(suggestion)} />)}
            </div>
          ) : (
            <div className="no-change-card"><p>No better nearby time was found. You can edit the event or keep the current plan.</p></div>
          )}
        </section>

        <details className="sources-panel">
          <summary><span>Sources</span><span>Details</span></summary>
          <div className="source-grid">
            {report.sources.map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className={`source-row state-${source.state}`}>
                <i />
                <span><b>{SOURCE_NAME[source.id] ?? source.name}</b><small>{sourceState(source)}</small></span>
                <em>↗</em>
              </a>
            ))}
          </div>
        </details>

        <footer className="report-footer">
          <Link href="/data">Data & privacy</Link>
        </footer>
      </main>
    </div>
  );
}
