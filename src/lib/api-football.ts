import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson, HttpError, safeMessage } from './http';
import { eventWindow, formatInstant, overlaps } from './time';
import { defaultPreference } from './preferences';
import { TeamSuggestion } from './teams';

const BASE = 'https://v3.football.api-sports.io';
const cancelled = new Set(['CANC', 'PST', 'SUSP', 'ABD']);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AfTeam = { id?: number; name?: string; country?: string };
type AfFixture = {
  fixture?: { id?: number; date?: string; status?: { short?: string } };
  teams?: { home?: AfTeam; away?: AfTeam };
  league?: { name?: string };
};
type AfResponse = { response?: AfFixture[]; errors?: Record<string, string> };

/** Live team search against the user's API-Football key; cached per query for 30 days. */
export async function searchApiFootballTeams(query: string): Promise<TeamSuggestion[]> {
  const key = process.env.API_FOOTBALL_KEY;
  const q = query.trim();
  if (!key || q.length < 2 || q.length > 150) return [];
  try {
    return await cached(`af:teams:${q.toLowerCase()}`, 30 * 86400000, async () => {
      const data = await fetchJson<{ response?: Array<{ team?: AfTeam }> }>(
        `${BASE}/teams?search=${encodeURIComponent(q)}`,
        { headers: { 'x-apisports-key': key } },
      );
      const out: TeamSuggestion[] = [];
      const seen = new Set<number>();
      for (const row of data.response ?? []) {
        const team = row.team;
        if (!team || typeof team.id !== 'number' || !team.name || seen.has(team.id)) continue;
        seen.add(team.id);
        out.push({ id: team.id, name: team.name, detail: [team.country, 'API-Football'].filter(Boolean).join(' · ') });
      }
      return out.slice(0, 5);
    });
  } catch {
    return [];
  }
}

/** The part of the group's selections that should be checked by API-Football. */
export function apiFootballSelections(input: EventInput) {
  return (input.footballTeams ?? []).filter((team) => team.source === 'api-football');
}

export async function checkFootballAf(input: EventInput): Promise<CheckResult> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  const checkedAt = new Date().toISOString();
  const base = { source: 'API-Football', sourceId: 'football-af', url: 'https://www.api-football.com/', lastChecked: checkedAt };
  const teams = apiFootballSelections(input);
  if (!teams.length) return { ...base, state: 'not_applicable', data: [], message: 'No API-Football team selected' };
  if (!apiKey) return { ...base, state: 'not_configured', data: [], message: 'Not connected' };
  const timezone = input.venue.timezone;
  if (!timezone) return { ...base, state: 'unavailable', data: [], message: 'Venue timezone unavailable' };

  try {
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const from = new Date(start.getTime() - 6 * 60 * 60_000).toISOString().slice(0, 10);
    const to = new Date(end.getTime() + 86400000).toISOString().slice(0, 10);
    const season = start.getUTCMonth() >= 6 ? start.getUTCFullYear() : start.getUTCFullYear() - 1;
    const data: CheckResult['data'] = [];
    const reasons: string[] = [];
    let failures = 0;
    for (const [index, team] of teams.entries()) {
      if (index > 0) await sleep(1100);
      try {
        const response: AfResponse = await cached(`af:fixtures:${team.id}:${season}:${from}:${to}`, 3 * 3600_000, async () =>
          fetchJson<AfResponse>(`${BASE}/fixtures?team=${team.id}&season=${season}&from=${from}&to=${to}`, { headers: { 'x-apisports-key': apiKey } }),
        );
        const errors = Object.values(response.errors ?? {});
        if (errors.length) throw new Error(errors.join(' '));
        for (const match of response.response ?? []) {
          if (cancelled.has(match.fixture?.status?.short ?? '') || typeof match.fixture?.id !== 'number') continue;
          const matchStart = new Date(match.fixture.date ?? '');
          if (!Number.isFinite(matchStart.getTime())) continue;
          const matchEnd = new Date(matchStart.getTime() + 120 * 60_000);
          if (!overlaps(start, end, matchStart, matchEnd)) continue;
          const home = match.teams?.home?.name ?? 'Unknown';
          const away = match.teams?.away?.name ?? 'Unknown';
          data.push({
            id: `afi-${match.fixture.id}`,
            type: 'sport' as const,
            title: `${home} vs ${away}`,
            description: `${match.league?.name ?? 'Football'} · ${formatInstant(match.fixture.date!, timezone)} · API-Football`,
            impact: 'high' as const,
            source: base.source,
            sourceUrl: base.url,
            preference: defaultPreference('sport', input),
            startsAt: match.fixture.date,
            endsAt: matchEnd.toISOString(),
            providerId: 'football',
            evidence: 'structured' as const,
            timing: 'scheduled' as const,
            relevance: 'overlap' as const,
            resolutionEligible: true,
            caveat: 'A two-hour match window is estimated from kickoff. Extra time, delays and schedule changes can extend it.',
          });
        }
      } catch (error) {
        failures += 1;
        reasons.push(error instanceof HttpError ? safeMessage(error) : error instanceof Error ? error.message : safeMessage(error));
      }
    }
    if (failures === teams.length) {
      return { ...base, state: 'unavailable', data: [], message: [...new Set(reasons)].join(' · ') || 'Every team fixture check failed' };
    }
    return {
      ...base,
      state: failures ? 'partial' : 'checked',
      data,
      message: failures ? `Some team fixture checks could not be confirmed. ${[...new Set(reasons)].join(' · ')}` : 'Published worldwide fixtures for the selected teams; the free plan allows 100 requests a day.',
    };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: safeMessage(error) };
  }
}