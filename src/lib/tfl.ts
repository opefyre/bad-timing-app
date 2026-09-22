import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson } from './http';
import { isGreaterLondon } from './geo';
import { defaultPreference } from './preferences';
import { eventWindow, localDate, overlaps } from './time';

type Validity = { from?: string; to?: string; isNow?: boolean };
type Disruption = { id?: string; category?: string; categoryDescription?: string; description?: string; additionalInfo?: string; closureText?: string; validityPeriods?: Validity[] };
type Stop = { id: string; commonName?: string; lines?: Array<{ id: string; name?: string }> };
type StopResponse = { stopPoints?: Stop[] };
type LineStatus = { statusSeverity?: number; statusSeverityDescription?: string; reason?: string; validityPeriods?: Validity[] };
type Line = { id: string; name: string; lineStatuses?: LineStatus[] };

function addKeys(url: URL) {
  const appKey = process.env.TFL_APP_KEY;
  if (appKey) url.searchParams.set('app_key', appKey);
  return url;
}

function validityOverlaps(periods: Validity[] | undefined, start: Date, end: Date): boolean {
  if (!periods?.length) return true;
  return periods.some((period) => {
    const from = period.from ? new Date(period.from) : new Date(0);
    const to = period.to ? new Date(period.to) : new Date('9999-12-31T23:59:59Z');
    return overlaps(start, end, from, to);
  });
}

export async function checkTfLDisruptions(input: EventInput): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { source: 'Transport for London', sourceId: 'tfl', url: 'https://tfl.gov.uk/info-for/open-data-users/', lastChecked: checkedAt };
  const { lat, lng, timezone } = input.venue;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !timezone || !isGreaterLondon(lat, lng)) {
    return { ...base, state: 'not_applicable', data: [], message: 'London-only data source' };
  }

  try {
    const stopUrl = addKeys(new URL('https://api.tfl.gov.uk/StopPoint'));
    stopUrl.searchParams.set('lat', String(lat));
    stopUrl.searchParams.set('lon', String(lng));
    stopUrl.searchParams.set('radius', '1200');
    stopUrl.searchParams.set('stopTypes', 'NaptanMetroStation,NaptanRailStation,NaptanBusCoachStation');
    stopUrl.searchParams.set('useStopPointHierarchy', 'true');
    const stops = await cached(`tfl-stops:${lat.toFixed(3)}:${lng.toFixed(3)}`, 6 * 60 * 60_000, () => fetchJson<StopResponse>(stopUrl.toString()));
    const nearby = (stops.stopPoints ?? []).slice(0, 8);
    if (!nearby.length) return { ...base, state: 'checked', data: [] };
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const findings = [];

    const stopIds = nearby.map((stop) => stop.id).filter(Boolean).slice(0, 6);
    if (stopIds.length) {
      const disruptionUrl = addKeys(new URL(`https://api.tfl.gov.uk/StopPoint/${stopIds.join(',')}/Disruption`));
      const disruptions = await cached(`tfl-disruption:${stopIds.join(',')}:${localDate(input.dateTime)}`, 5 * 60_000, () => fetchJson<Disruption[]>(disruptionUrl.toString()));
      for (const disruption of disruptions) {
        if (!validityOverlaps(disruption.validityPeriods, start, end)) continue;
        findings.push({
          id: `tfl-stop-${disruption.id ?? findings.length}`,
          type: 'transport' as const,
          title: disruption.categoryDescription || disruption.category || 'Nearby transport disruption',
          description: disruption.description || disruption.additionalInfo || disruption.closureText || 'TfL reports a disruption near the venue.',
          impact: 'medium' as const,
          source: base.source,
          sourceUrl: 'https://tfl.gov.uk/status-updates',
          preference: defaultPreference('transport', input),
          startsAt: disruption.validityPeriods?.[0]?.from,
          endsAt: disruption.validityPeriods?.[0]?.to,
        });
      }
    }

    const lineIds = Array.from(new Set(nearby.flatMap((stop) => (stop.lines ?? []).map((line) => line.id)))).slice(0, 10);
    if (lineIds.length) {
      const date = localDate(input.dateTime);
      const statusUrl = addKeys(new URL(`https://api.tfl.gov.uk/Line/${lineIds.join(',')}/Status/${date}/to/${date}`));
      const lines = await cached(`tfl-lines:${lineIds.join(',')}:${date}`, 5 * 60_000, () => fetchJson<Line[]>(statusUrl.toString()));
      for (const line of lines) {
        for (const status of line.lineStatuses ?? []) {
          if (!status.reason || status.statusSeverityDescription?.toLowerCase() === 'good service') continue;
          if (!validityOverlaps(status.validityPeriods, start, end)) continue;
          findings.push({
            id: `tfl-line-${line.id}-${status.statusSeverity ?? 0}-${date}`,
            type: 'transport' as const,
            title: `${line.name}: ${status.statusSeverityDescription ?? 'service change'}`,
            description: status.reason,
            impact: (status.statusSeverity !== undefined && status.statusSeverity <= 5 ? 'high' : 'medium') as 'high' | 'medium',
            source: base.source,
            sourceUrl: 'https://tfl.gov.uk/status-updates',
            preference: defaultPreference('transport', input),
            startsAt: status.validityPeriods?.[0]?.from,
            endsAt: status.validityPeriods?.[0]?.to,
          });
        }
      }
    }

    const deduped = Array.from(new Map(findings.map((finding) => [`${finding.title}|${finding.description}`, finding])).values());
    return { ...base, state: 'checked', data: deduped };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: error instanceof Error ? error.message : 'Request failed' };
  }
}
