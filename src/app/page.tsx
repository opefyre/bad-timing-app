'use client';

import { useState } from 'react';
import EventForm from '@/components/EventForm';
import { EventInput, Report } from '@/types';

const ICONS: Record<string, string> = { daylight: '☀️', sport: '⚽', transport: '🚇', weather: '🌧️', holiday: '🎉', tv: '📺', nearby_event: '🎭' };
const LABELS: Record<string, string> = { daylight: 'Daylight', sport: 'Football', transport: 'Getting there', weather: 'Weather', holiday: 'Holiday', tv: 'TV', nearby_event: 'Nearby event' };
const COLORS: Record<string, string> = {
  daylight: 'var(--mustard)',
  sport: 'var(--moss)',
  transport: 'var(--berry)',
  weather: 'var(--blue)',
  holiday: 'var(--plum)',
  tv: 'var(--burnt)',
  nearby_event: 'var(--burnt)',
};

function summary(type: string, desc: string): string {
  const d = desc.toLowerCase();
  if (type === 'daylight') return d.includes('before your event') ? 'sunset falls before your event begins' : d.includes('during') ? 'sunset falls during your event' : desc;
  if (type === 'sport') return 'the team plays during your meetup';
  if (type === 'transport') return 'a disruption near the venue affects that day';
  return desc;
}

export default function Home() {
  const [report, setReport] = useState<Report | null>(null);
  const [comparison, setComparison] = useState<{ original: Report; alternative: Report; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cur, setCur] = useState<EventInput | null>(null);

  const analyze = async (input: EventInput) => {
    setLoading(true); setError(null); setComparison(null); setCur(input);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!r.ok) throw new Error('Analysis failed');
      setReport(await r.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setLoading(false);
  };

  const tryAlt = async (dOff: number, hOff: number) => {
    if (!cur || !report) return;
    setLoading(true);
    const orig = report;
    const dt = new Date(cur.dateTime);
    dt.setDate(dt.getDate() + dOff);
    dt.setHours(dt.getHours() + hOff);
    const inp = { ...cur, dateTime: dt.toISOString() };
    setCur(inp);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inp) });
      if (!r.ok) throw new Error('Analysis failed');
      const alt = await r.json();
      const desc = dOff !== 0
        ? `Moved to ${dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
        : `Started at ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} instead`;
      setComparison({ original: orig, alternative: alt, desc });
      setReport(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    setLoading(false);
  };

  const reset = () => { setReport(null); setComparison(null); setCur(null); setError(null); };

  const renderConflicts = (conflicts: Report['conflicts'], compact = false) => {
    const avoid = conflicts.filter((c) => c.preference === 'avoid');
    const other = conflicts.filter((c) => c.preference !== 'avoid');
    if (avoid.length === 0 && other.length === 0) {
      return (
        <div className="conflict-item resolved" style={{ ['--tag' as string]: 'var(--moss)' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">✓</span>
            <div>
              <p className="font-bold">All clear</p>
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Nothing found in the sources checked</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div>
        {avoid.map((c) => (
          <div key={c.id} className={`conflict-item ${compact ? '!py-2 text-sm' : ''}`} style={{ ['--tag' as string]: COLORS[c.type] || 'var(--burnt)' }}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{ICONS[c.type] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{LABELS[c.type] || c.type}<span className="font-normal" style={{ color: 'var(--ink-soft)' }}>: {summary(c.type, c.description)}.</span></p>
                {!compact && <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{c.source}</p>}
              </div>
            </div>
          </div>
        ))}
        {other.length > 0 && !compact && (
          <div className="mt-4">
            <p className="paper-label mb-2" style={{ background: 'var(--paper-dark)', color: 'var(--ink-soft)' }}>Also noted</p>
            {other.map((c) => (
              <div key={c.id} className="flex items-start gap-3 text-sm py-1 muted" style={{ color: 'var(--ink-faint)' }}>
                <span>{ICONS[c.type] || '📌'}</span>
                <span>{LABELS[c.type]}: {summary(c.type, c.description)}.</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen">
      {/* cut-paper diorama behind everything */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
        <div className="paper-sheet" style={{ top: '10%', left: '-6%', width: '24rem', height: '24rem', background: 'var(--mustard)', opacity: 0.16, transform: 'rotate(-16deg)' }} />
        <div className="paper-sheet" style={{ top: '6%', left: '-3%', width: '19rem', height: '19rem', background: 'var(--paper-light)', transform: 'rotate(-7deg)' }} />
        <div className="paper-sheet" style={{ top: '46%', right: '-8%', width: '22rem', height: '22rem', background: 'var(--moss)', opacity: 0.14, transform: 'rotate(14deg)' }} />
        <div className="paper-sheet" style={{ top: '50%', right: '-5%', width: '17rem', height: '17rem', background: 'var(--paper-light)', transform: 'rotate(6deg)' }} />
        <div className="paper-sheet" style={{ bottom: '4%', left: '10%', width: '14rem', height: '14rem', background: 'var(--blue)', opacity: 0.12, transform: 'rotate(20deg)' }} />
        <div className="paper-sheet" style={{ bottom: '10%', left: '6%', width: '11rem', height: '11rem', background: 'var(--paper-light)', transform: 'rotate(9deg)' }} />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-14">
        {/* folded title sheet */}
        <header className={`text-center mb-12 ${report || comparison || loading ? '' : 'animate-in'}`}>
          <div className="inline-block relative px-6 sm:px-10 py-6" style={{ background: 'var(--paper-light)', boxShadow: '7px 7px 0 var(--shadow-1), 14px 18px 24px var(--shadow-2)' }}>
            <h1 className="logo text-5xl md:text-6xl font-bold tracking-tight">BAD TIMING</h1>
            <p className="text-xl mt-2" style={{ color: 'var(--ink-soft)' }}>Check the date before you <s style={{ textDecorationColor: 'var(--berry)', textDecorationThickness: '3px' }}>send</s> cut the invitation.</p>
          </div>
          <div className="zigzag-bar" />
          <p className="mt-4" style={{ color: 'var(--ink-soft)' }}>Your calendar says you&apos;re free — check whether the rest of the world agrees.</p>
        </header>

        {!report && !comparison && !loading && (
          <div className="paper-card animate-in-1">
            <div className="tape" />
            <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Georgia, serif' }}>Plan your event</h2>
            <hr className="rule-dashed" />
            <div className="paper-clip">
              <EventForm onSubmit={analyze} isLoading={loading} />
            </div>
          </div>
        )}

        {loading && (
          <div className="paper-card text-center py-14">
            <div className="flex items-center justify-center">
              <div className="sheet-loading" />
            </div>
            <p className="text-lg font-bold mt-6" style={{ color: 'var(--ink)' }}>Cutting the report together...</p>
            <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>Weather, events, transport, daylight</p>
          </div>
        )}

        {error && !loading && (
          <div className="paper-card animate-in" style={{ ['--tag' as string]: 'var(--berry)' }}>
            <div className="tape" />
            <p className="font-bold mb-2" style={{ color: 'var(--berry)' }}>Out of paper</p>
            <p className="mb-4" style={{ color: 'var(--ink-soft)' }}>{error}</p>
            <button onClick={reset} className="paper-btn">Start over</button>
          </div>
        )}

        {!loading && report && (
          <div className="space-y-8 animate-in">
            <div className="paper-card">
              <div className="flex items-center gap-3 mb-1">
                <div className="pin" />
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>Three things worth knowing</h2>
              </div>
              <p className="text-sm mb-5" style={{ color: 'var(--ink-faint)' }}>
                Checked {new Set(report.sources.map((s) => s.name)).size} sources at {new Date(report.checkedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="paper-clip">{renderConflicts(report.conflicts)}</div>
            </div>

            {report.suggestions.length > 0 && report.conflicts.some((c) => c.preference === 'avoid') && (
              <div className="paper-card animate-in-1" style={{ background: 'var(--mustard)' }}>
                <div className="tape" style={{ background: 'rgba(250, 246, 236, 0.55)' }} />
                <p className="paper-label mb-3">Smallest useful change</p>
                <p className="text-2xl font-bold mb-3" style={{ fontFamily: 'Georgia, serif' }}>{report.suggestions[0].change}</p>
                <div className="space-y-1">
                  {report.suggestions[0].conflictsResolved.length > 0 && (
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>
                      ✓ This avoids the {report.suggestions[0].conflictsResolved.map((id) => { const c = report.conflicts.find((x) => x.id === id); return c ? LABELS[c.type]?.toLowerCase() : ''; }).filter(Boolean).join(' and ')}.
                    </p>
                  )}
                  {report.suggestions[0].conflictsRemaining.length > 0 && (
                    <p style={{ color: 'var(--ink-soft)' }}>
                      ⚠ The {report.suggestions[0].conflictsRemaining.map((id) => { const c = report.conflicts.find((x) => x.id === id); return c ? LABELS[c.type]?.toLowerCase() : ''; }).filter(Boolean).join(' and ')} still {report.suggestions[0].conflictsRemaining.length > 1 ? 'apply' : 'applies'}.
                    </p>
                  )}
                </div>
              </div>
            )}

            {report.conflicts.some((c) => c.preference === 'avoid') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 animate-in-2">
                <button onClick={() => tryAlt(1, 0)} className="paper-btn text-left">
                  <span className="block font-bold">Keep the time</span>
                  <span className="text-sm font-normal">try another day →</span>
                </button>
                <button onClick={() => tryAlt(0, -2)} className="paper-btn paper-btn-accent text-left">
                  <span className="block font-bold">Keep the day</span>
                  <span className="text-sm font-normal">try earlier →</span>
                </button>
              </div>
            )}

            <div className="animate-in-3">
              <p className="paper-label mb-3" style={{ background: 'var(--paper-dark)', color: 'var(--ink-soft)' }}>Sources</p>
              <div className="flex flex-wrap gap-3">
                {report.sources.map((s, i) => (
                  <span key={i} className="paper-chip">{s.name}</span>
                ))}
              </div>
            </div>

            {report.coverageGaps.length > 0 && (
              <div className="paper-card" style={{ borderLeft: '9px solid var(--berry)' }}>
                <p className="paper-label mb-2" style={{ background: 'var(--berry)' }}>Coverage gaps</p>
                {report.coverageGaps.map((g, i) => (
                  <p key={i} className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>{g}</p>
                ))}
              </div>
            )}

            <button onClick={reset} className="paper-btn w-full" style={{ color: 'var(--ink-faint)' }}>
              Start over with a new event
            </button>
          </div>
        )}

        {!loading && comparison && (
          <div className="space-y-8 animate-in">
            <div className="paper-card" style={{ background: 'var(--moss)' }}>
              <div className="flex items-center justify-between">
                <p className="paper-label mb-0" style={{ background: 'var(--paper-light)', color: 'var(--ink)' }}>{comparison.desc}</p>
                <button onClick={() => { setReport(comparison.original); setComparison(null); }} className="paper-btn !px-4 !py-1 text-sm font-bold">← back</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in-1">
              <div>
                <p className="paper-label mb-3">Original</p>
                <div className="paper-card !p-5">{renderConflicts(comparison.original.conflicts, true)}</div>
              </div>
              <div>
                <p className="paper-label mb-3" style={{ background: 'var(--moss)' }}>Picked</p>
                <div className="paper-card !p-5">{renderConflicts(comparison.alternative.conflicts, true)}</div>
              </div>
            </div>

            <div className="paper-card animate-in-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="pin" />
                <h3 className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>What changed?</h3>
              </div>
              <div className="space-y-3">
                {comparison.original.conflicts.filter((c) => c.preference === 'avoid').map((c) => {
                  const resolved = !comparison.alternative.conflicts.some((ac) => ac.id === c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-3 text-sm font-bold">
                      <span className={`px-2 py-0.5 ${resolved ? 'tag-good' : 'tag-bad'}`}>{resolved ? '✓' : '—'}</span>
                      <span className={resolved ? '' : ''} style={resolved ? {} : { color: 'var(--ink-faint)' }}>{c.title}</span>
                      <span className={`ml-auto text-xs ${resolved ? 'tag-good px-2 py-0.5' : 'tag-bad px-2 py-0.5'}`}>{resolved ? 'resolved' : 'still applies'}</span>
                    </div>
                  );
                })}
              </div>
              <button onClick={reset} className="paper-btn paper-btn-dark w-full mt-6">
                Start over with a new event
              </button>
            </div>
          </div>
        )}

        <footer className="mt-16 pt-6 text-center">
          <hr className="rule-dashed" />
          <p className="text-sm mt-4" style={{ color: 'var(--ink-faint)' }}>
            BAD TIMING checks external sources only — it never touches your personal calendar. ✂
          </p>
        </footer>
      </div>
    </div>
  );
}