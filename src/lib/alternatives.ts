import { Conflict, EventInput, PreferenceOverrides, Report, Suggestion } from '@/types';
import { AnalysisContext, analyzeEvent } from './analyzer';
import { addLocalDays, addLocalMinutes, formatLocalDateTime, minuteDistance } from './time';

function preferenceFor(conflict: Conflict, overrides: PreferenceOverrides) {
  return overrides[conflict.id] ?? conflict.preference;
}

function describeChange(mode: Suggestion['mode'], original: EventInput, candidate: EventInput) {
  const formatted = formatLocalDateTime(candidate.dateTime);
  if (mode === 'earlier') return `Start earlier · ${formatted}`;
  const time = candidate.dateTime.slice(11, 16);
  return `Keep ${time} · move to ${formatted.split(',')[0] ?? formatted}`;
}

async function evaluateCandidate(
  mode: Suggestion['mode'],
  base: Report,
  candidateDateTime: string,
  overrides: PreferenceOverrides,
  context: AnalysisContext,
): Promise<Suggestion | null> {
  const candidateEvent: EventInput = { ...base.event, venue: { ...base.event.venue }, dateTime: candidateDateTime };
  const candidate = await analyzeEvent(candidateEvent, context);
  const baseAvoid = base.conflicts.filter((conflict) => preferenceFor(conflict, overrides) === 'avoid');
  const basePlan = base.conflicts.filter((conflict) => preferenceFor(conflict, overrides) === 'plan_around');
  const baseCheckedSources = new Set(base.sources.filter((source) => source.state === 'checked').map((source) => source.id));
  const lostCoverage = candidate.sources.some((source) => baseCheckedSources.has(source.id) && (source.state === 'unavailable' || source.state === 'out_of_range'));
  if (lostCoverage) return null;

  const candidateAvoid = candidate.conflicts.filter((conflict) => preferenceFor(conflict, overrides) === 'avoid');
  const candidateAvoidIds = new Set(candidateAvoid.map((conflict) => conflict.id));
  const baseAvoidIds = new Set(baseAvoid.map((conflict) => conflict.id));
  const candidateIds = new Set(candidate.conflicts.map((conflict) => conflict.id));

  if (candidateAvoid.length >= baseAvoid.length) return null;

  return {
    mode,
    change: describeChange(mode, base.event, candidateEvent),
    newDateTime: candidateDateTime,
    conflictsResolved: baseAvoid.filter((conflict) => !candidateAvoidIds.has(conflict.id)).map((conflict) => conflict.title),
    conflictsRemaining: baseAvoid.filter((conflict) => candidateAvoidIds.has(conflict.id)).map((conflict) => conflict.title),
    conflictsAdded: candidateAvoid.filter((conflict) => !baseAvoidIds.has(conflict.id)).map((conflict) => conflict.title),
    planAroundKept: basePlan.filter((conflict) => candidateIds.has(conflict.id)).map((conflict) => conflict.title),
    avoidCount: candidateAvoid.length,
    changeMinutes: minuteDistance(base.event.dateTime, candidateDateTime),
  };
}

function best(candidates: Array<Suggestion | null>): Suggestion | null {
  return candidates.filter((item): item is Suggestion => Boolean(item)).sort((a, b) => {
    if (a.avoidCount !== b.avoidCount) return a.avoidCount - b.avoidCount;
    if (a.conflictsAdded.length !== b.conflictsAdded.length) return a.conflictsAdded.length - b.conflictsAdded.length;
    if (a.planAroundKept.length !== b.planAroundKept.length) return b.planAroundKept.length - a.planAroundKept.length;
    return a.changeMinutes - b.changeMinutes;
  })[0] ?? null;
}

export async function findAlternatives(base: Report, overrides: PreferenceOverrides = {}, context: AnalysisContext = {}): Promise<Suggestion[]> {
  const baseAvoid = base.conflicts.filter((conflict) => preferenceFor(conflict, overrides) === 'avoid');
  if (!baseAvoid.length) return [];

  const earlierTimes = [-30, -60, -90, -120, -180, -240]
    .map((minutes) => addLocalMinutes(base.event.dateTime, minutes))
    .filter((candidate) => candidate.slice(0, 10) === base.event.dateTime.slice(0, 10));
  const otherDays = [1, 2, 3, 7].map((days) => addLocalDays(base.event.dateTime, days));

  const [earlierResults, dayResults] = await Promise.all([
    Promise.all(earlierTimes.map((candidate) => evaluateCandidate('earlier', base, candidate, overrides, context))),
    Promise.all(otherDays.map((candidate) => evaluateCandidate('another_day', base, candidate, overrides, context))),
  ]);

  return [best(earlierResults), best(dayResults)]
    .filter((item): item is Suggestion => Boolean(item))
    .sort((a, b) => a.avoidCount - b.avoidCount || a.changeMinutes - b.changeMinutes);
}
