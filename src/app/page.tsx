'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import EventForm from '@/components/EventForm';
import Logo from '@/components/Logo';
import ReportView from '@/components/ReportView';
import Credits from '@/components/Credits';
import { EventInput, EventPreference, PreferenceOverrides, Report, Suggestion } from '@/types';

export default function Home() {
  const activeRequest=useRef<AbortController|null>(null);
  const requestId=useRef(0);
  const [phase, setPhase] = useState<'setup' | 'report'>('setup');
  const [lastInput, setLastInput] = useState<EventInput | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [preferences, setPreferences] = useState<PreferenceOverrides>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [recommendationDirty, setRecommendationDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlternatives=useCallback(async(baseReport:Report,prefs:PreferenceOverrides,mode:'earlier'|'another_day')=>{
    activeRequest.current?.abort();const controller=new AbortController();activeRequest.current=controller;const id=++requestId.current;
    setRecommendationBusy(true);setError(null);
    try{const response=await fetch('/api/alternatives',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({event:baseReport.event,preferences:prefs,mode})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not compare times');
      if(id!==requestId.current)return;setReport(data);setRecommendationDirty(false);
    }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Could not compare times');}
    finally{if(id===requestId.current)setRecommendationBusy(false);}
  },[]);

  const analyze = useCallback(async (input: EventInput) => {
    activeRequest.current?.abort();const controller=new AbortController();activeRequest.current=controller;const id=++requestId.current;
    setAnalyzing(true);setRecommendationBusy(false);
    setError(null);
    setLastInput(input);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),signal:controller.signal,
      });
      const data = await response.json() as Report & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not check this date');
      if(id!==requestId.current)return;
      setReport(data);
      setLastInput(data.event);
      setPhase('report');
      setRecommendationDirty(true);
    } catch (err) {
      if(controller.signal.aborted)return;
      setError(err instanceof Error ? err.message : 'Could not check this date');
      setPhase('setup');
    } finally {
      if(id===requestId.current)setAnalyzing(false);
    }
  }, []);

  function updatePreference(id: string, preference: EventPreference) {
    activeRequest.current?.abort();requestId.current++;setRecommendationBusy(false);
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
          recommendationBusy={recommendationBusy||analyzing}
          recommendationDirty={recommendationDirty}
          onPreference={updatePreference}
          onRecalculate={(mode) => void loadAlternatives(report, preferences,mode)}
          onApply={applySuggestion}
          onEdit={() => {activeRequest.current?.abort();requestId.current++;setRecommendationBusy(false);setAnalyzing(false);setPhase('setup');}}
          onRerun={() => void analyze(report.event)}
        />
      </>
    );
  }

  return (
    <div className="setup-page">
      <div className="pixel-grid-bg" aria-hidden="true" />
      <main className="setup-shell">
        <header className="site-header">
          <Link className="brand" href="/" aria-label="Bad Timing home"><Logo size={36} /><strong>BAD TIMING</strong></Link>
          <Link className="plain-link" href="/data">Data & privacy</Link>
        </header>

        <section className="hero-block clean-hero">
          <h1>BAD<br/><span>TIMING</span></h1>
          <p>What might interfere with your event?</p>
        </section>

        <section className="form-panel">
          {error && <div className="inline-error" role="alert"><span>{error}</span></div>}
          <EventForm onSubmit={analyze} isLoading={analyzing} initialData={lastInput} />
        </section>

        <Credits/>
      </main>
    </div>
  );
}
