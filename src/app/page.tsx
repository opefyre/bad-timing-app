'use client';

import { useCallback, useState } from 'react';
import EventForm from '@/components/EventForm';
import ReportView from '@/components/ReportView';
import { EventInput, EventPreference, PreferenceOverrides, Report, Suggestion } from '@/types';

export default function Home() {
  const [phase, setPhase] = useState<'setup' | 'report'>('setup');
  const [lastInput, setLastInput] = useState<EventInput | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [preferences, setPreferences] = useState<PreferenceOverrides>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [recommendationDirty, setRecommendationDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlternatives = useCallback(async (baseReport: Report, prefs: PreferenceOverrides) => {
    const avoidCount = baseReport.conflicts.filter((conflict) => (prefs[conflict.id] ?? conflict.preference) === 'avoid').length;
    if (!avoidCount) {
      setReport({ ...baseReport, suggestions: [] });
      setRecommendationDirty(false);
      return;
    }
    setRecommendationBusy(true);
    try {
      const response = await fetch('/api/alternatives', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: baseReport, preferences: prefs }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Alternative search failed');
      setReport((current) => current ? { ...current, suggestions: data.suggestions ?? [] } : current);
      setRecommendationDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate alternatives');
    } finally {
      setRecommendationBusy(false);
    }
  }, []);

  const analyze = useCallback(async (input: EventInput) => {
    setAnalyzing(true);
    setError(null);
    setLastInput(input);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      const data = await response.json() as Report & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Analysis failed');
      const prefs = Object.fromEntries(data.conflicts.map((conflict) => [conflict.id, conflict.preference])) as PreferenceOverrides;
      setPreferences(prefs);
      setReport(data);
      setLastInput(data.event);
      setPhase('report');
      setRecommendationDirty(false);
      void loadAlternatives(data, prefs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setPhase('setup');
    } finally {
      setAnalyzing(false);
    }
  }, [loadAlternatives]);

  function updatePreference(id: string, preference: EventPreference) {
    setPreferences((current) => ({ ...current, [id]: preference }));
    setRecommendationDirty(true);
  }

  function applySuggestion(suggestion: Suggestion) {
    if (!report) return;
    void analyze({ ...report.event, venue: { ...report.event.venue }, dateTime: suggestion.newDateTime });
  }

  if (phase === 'report' && report) {
    return (
      <>
        {error && <div className="global-error" role="alert">{error}<button onClick={() => setError(null)} type="button">×</button></div>}
        <ReportView
          report={report}
          preferences={preferences}
          recommendationBusy={recommendationBusy}
          recommendationDirty={recommendationDirty}
          onPreference={updatePreference}
          onRecalculate={() => void loadAlternatives(report, preferences)}
          onApply={applySuggestion}
          onEdit={() => setPhase('setup')}
          onRerun={() => void analyze(report.event)}
        />
      </>
    );
  }

  return (
    <div className="setup-page">
      <div className="pixel-grid-bg" aria-hidden="true" />
      <main className="setup-shell">
        <header className="hero-block">
          <div className="logo-mark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <p className="eyebrow">PRE-INVITATION REALITY CHECK</p>
          <h1><span>BAD</span><span>TIMING</span></h1>
          <p className="hero-copy">What are you overlooking about this place and time?</p>
          <div className="hero-signal-strip" aria-hidden="true">
            <span>EVENTS</span><i /> <span>SPORT</span><i /> <span>TV</span><i /> <span>HOLIDAYS</span><i /> <span>WEATHER</span><i /> <span>DAYLIGHT</span><i /> <span>TRANSPORT</span>
          </div>
        </header>

        <section className="form-panel">
          <div className="form-panel-head"><span>NEW CHECK</span><span>PUBLIC DATA ONLY</span></div>
          {error && <div className="inline-error" role="alert"><strong>CHECK FAILED</strong><span>{error}</span></div>}
          <EventForm onSubmit={analyze} isLoading={analyzing} initialData={lastInput} />
        </section>

        <footer className="setup-footer">
          <span>NO PRIVATE CALENDARS.</span><span>NO FAKE SUCCESS SCORE.</span><span>YOU DECIDE WHAT MATTERS.</span>
        </footer>
      </main>
    </div>
  );
}
