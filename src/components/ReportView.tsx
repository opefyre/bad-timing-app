'use client';

import { useMemo, useState } from 'react';
import { Conflict, EventPreference, PreferenceOverrides, Report, Suggestion } from '@/types';
import { formatLocalDateTime } from '@/lib/time';

const TYPE_LABEL: Record<Conflict['type'], string> = {
  nearby_event: 'NEARBY EVENT', sport: 'FOOTBALL', tv: 'TV', holiday: 'HOLIDAY',
  weather: 'WEATHER', daylight: 'DAYLIGHT', transport: 'TRANSPORT',
};

const PREFS: Array<{ value: EventPreference; label: string; short: string }> = [
  { value: 'avoid', label: 'Avoid it', short: 'AVOID' },
  { value: 'neutral', label: "Doesn't matter", short: 'IGNORE' },
  { value: 'plan_around', label: 'Plan around it', short: 'PLAN AROUND' },
];

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

function FindingCard({ conflict, preference, onChange }: { conflict: Conflict; preference: EventPreference; onChange: (value: EventPreference) => void }) {
  return (
    <article className={`finding-card impact-${conflict.impact}`}>
      <div className="finding-index" aria-hidden="true">{TYPE_LABEL[conflict.type].slice(0, 2)}</div>
      <div className="finding-body">
        <div className="finding-kicker">
          <span>{TYPE_LABEL[conflict.type]}</span>
          <span className={`impact-dot ${conflict.impact}`}>{conflict.impact.toUpperCase()}</span>
        </div>
        <h3>{conflict.title}</h3>
        <p>{conflict.description}</p>
        <div className="finding-meta">
          {typeof conflict.distanceKm === 'number' && <span>{conflict.distanceKm.toFixed(1)} KM AWAY</span>}
          {conflict.sourceUrl ? <a href={conflict.sourceUrl} target="_blank" rel="noreferrer">{conflict.source} ↗</a> : <span>{conflict.source}</span>}
        </div>
      </div>
      <div className="intent-control" aria-label={`How to treat ${conflict.title}`}>
        <span>YOUR CALL</span>
        {PREFS.map((item) => (
          <button key={item.value} type="button" className={preference === item.value ? `active ${item.value}` : ''} onClick={() => onChange(item.value)} title={item.label}>
            {item.short}
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
        <span>{primary ? 'SMALLEST USEFUL CHANGE' : suggestion.mode === 'earlier' ? 'KEEP THE DAY' : 'KEEP THE TIME'}</span>
        <strong>{suggestion.avoidCount === 0 ? '0 AVOID CONFLICTS' : `${suggestion.avoidCount} LEFT`}</strong>
      </div>
      <h3>{suggestion.change}</h3>
      <div className="suggestion-columns">
        <div><b>RESOLVES</b><p>{suggestion.conflictsResolved.length ? suggestion.conflictsResolved.join(' · ') : '—'}</p></div>
        <div><b>STILL THERE</b><p>{suggestion.conflictsRemaining.length ? suggestion.conflictsRemaining.join(' · ') : 'Nothing you marked Avoid'}</p></div>
        {suggestion.conflictsAdded.length > 0 && <div><b>NEW</b><p>{suggestion.conflictsAdded.join(' · ')}</p></div>}
        {suggestion.planAroundKept.length > 0 && <div><b>KEEPS</b><p>{suggestion.planAroundKept.join(' · ')}</p></div>}
      </div>
      <button type="button" className="pixel-button invert" onClick={onApply}>USE THIS TIME →</button>
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
      <header className="report-topbar">
        <button type="button" className="brand-button" onClick={onEdit}><span className="brand-pixel">BT</span><strong>BAD TIMING</strong></button>
        <div className="report-actions">
          <button type="button" className="pixel-button ghost" onClick={onRerun}>RE-CHECK</button>
          <button type="button" className="pixel-button" onClick={onEdit}>EDIT EVENT</button>
        </div>
      </header>

      <main className="report-shell">
        <section className={`verdict-block ${avoid.length ? 'warn' : 'clear'}`}>
          <div className="verdict-code">{avoid.length ? '!!' : 'OK'}</div>
          <div>
            <p className="eyebrow">CHECK COMPLETE · {formatLocalDateTime(report.event.dateTime)} · {report.event.venue.timezone}</p>
            <h1>{avoid.length ? `${avoid.length} ${avoid.length === 1 ? 'thing' : 'things'} you chose to avoid.` : hasIncompleteCoverage ? 'No blockers found in the data we could check.' : 'Nothing you marked Avoid.'}</h1>
            <p className="verdict-copy">
              {report.event.venue.name || report.event.venue.address} · {report.event.durationMinutes} min · {report.event.isOutdoor ? 'outdoor' : 'indoor'}
              {planAround.length ? ` · ${planAround.length} item${planAround.length > 1 ? 's' : ''} to plan around` : ''}
            </p>
          </div>
        </section>

        {report.coverageGaps.length > 0 && (
          <section className="coverage-warning">
            <strong>NOT EVERYTHING COULD BE CHECKED.</strong>
            <span>{report.coverageGaps.join(' · ')}</span>
          </section>
        )}

        <section className="report-section">
          <div className="section-heading">
            <div><span className="step-tag">01 / WHAT YOU MAY BE OVERLOOKING</span><h2>{report.conflicts.length ? 'Things worth knowing' : 'Nothing obvious surfaced'}</h2></div>
            {report.conflicts.length > 3 && <button type="button" className="text-button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'SHOW LESS' : `SHOW ALL ${report.conflicts.length}`}</button>}
          </div>
          {report.conflicts.length ? (
            <div className="findings-list">
              {visible.map((conflict) => (
                <FindingCard key={conflict.id} conflict={conflict} preference={effectivePreference(conflict, preferences)} onChange={(value) => onPreference(conflict.id, value)} />
              ))}
            </div>
          ) : (
            <div className="empty-pixel"><span>···</span><p>No listed event, selected match/TV clash, holiday, weather, daylight or London transport issue surfaced for this window.</p></div>
          )}
        </section>

        <section className="report-section recommendation-zone">
          <div className="section-heading">
            <div><span className="step-tag">02 / SMALLEST CHANGE</span><h2>Make the timing work</h2></div>
            {recommendationDirty && !recommendationBusy && <button className="pixel-button accent" type="button" onClick={onRecalculate}>RECALCULATE →</button>}
          </div>

          {recommendationBusy ? (
            <div className="recommendation-loading"><span className="scanner-line" /><strong>TESTING REAL ALTERNATIVES</strong><p>Re-checking earlier times and nearby days against the same outside-world signals.</p></div>
          ) : avoid.length === 0 ? (
            <div className="no-change-card"><strong>NO CHANGE NEEDED.</strong><p>You have not marked any current finding as something to avoid. “Plan around” items stay visible but are not treated as blockers.</p></div>
          ) : recommendationDirty ? (
            <div className="no-change-card"><strong>YOUR INTENT CHANGED.</strong><p>Recalculate to test candidate times using the choices above.</p></div>
          ) : report.suggestions.length > 0 ? (
            <div className="suggestion-stack">
              {report.suggestions.map((suggestion, index) => <SuggestionCard key={`${suggestion.mode}-${suggestion.newDateTime}`} suggestion={suggestion} primary={index === 0} onApply={() => onApply(suggestion)} />)}
            </div>
          ) : (
            <div className="no-change-card"><strong>NO SMALLER FIX FOUND.</strong><p>The tested earlier times and nearby days did not reduce the conflicts you marked Avoid. Keep the current plan, change the venue, or edit the event inputs.</p></div>
          )}
        </section>

        <details className="sources-panel">
          <summary><span>03 / SOURCE STATUS</span><strong>{report.sources.filter((s) => s.state === 'checked').length}/{report.sources.length} CHECKED</strong></summary>
          <div className="source-grid">
            {report.sources.map((source) => (
              <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className={`source-row state-${source.state}`}>
                <i />
                <span><b>{source.name}</b><small>{source.message || source.state.replaceAll('_', ' ')}</small></span>
                <em>↗</em>
              </a>
            ))}
          </div>
        </details>

        <footer className="report-footer">
          <p>BAD TIMING checks public outside-world data. It does not know anyone&apos;s private calendar or availability.</p>
          <p>Weather: MET Norway · Daylight: <a href="https://sunrise-sunset.org/" target="_blank" rel="noreferrer">Sunrise-Sunset.org</a> · TV: <a href="https://www.tvmaze.com/" target="_blank" rel="noreferrer">TVmaze</a></p>
        </footer>
      </main>
    </div>
  );
}
