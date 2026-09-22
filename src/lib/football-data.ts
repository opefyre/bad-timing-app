import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson } from './http';
import { eventWindow, formatInstant, overlaps } from './time';
import { defaultPreference } from './preferences';

type Match = {
  id: number;
  utcDate: string;
  status: string;
  competition?: { name?: string };
  homeTeam: { name: string; shortName?: string; tla?: string };
  awayTeam: { name: string; shortName?: string; tla?: string };
};
type MatchesResponse = { matches?: Match[] };

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function teamMatches(team: string, match: Match) {
  const needle = normalise(team);
  const names = [match.homeTeam.name, match.homeTeam.shortName, match.homeTeam.tla, match.awayTeam.name, match.awayTeam.shortName, match.awayTeam.tla]
    .filter(Boolean).map((value) => normalise(String(value)));
  return names.some((name) => name === needle || name.includes(needle) || needle.includes(name));
}

export async function checkFootballData(input: EventInput): Promise<CheckResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  const checkedAt = new Date().toISOString();
  const base = { source: 'football-data.org', sourceId: 'football', url: 'https://www.football-data.org/', lastChecked: checkedAt };
  if (!input.footballTeam) return { ...base, state: 'not_applicable', data: [], message: 'No team selected' };
  if (!apiKey) return { ...base, state: 'unavailable', data: [], message: 'API key not configured' };
  const timezone = input.venue.timezone;
  if (!timezone) return { ...base, state: 'unavailable', data: [], message: 'Venue timezone unavailable' };

  try {
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const queryFrom = new Date(start.getTime() - 6 * 60 * 60_000).toISOString().slice(0, 10);
    const queryTo = new Date(end.getTime() + 6 * 60 * 60_000).toISOString().slice(0, 10);
    const key = `football:${queryFrom}:${queryTo}`;
    const data = await cached(key, 5 * 60_000, async () => {
      const url = new URL('https://api.football-data.org/v4/matches');
      url.searchParams.set('dateFrom', queryFrom);
      url.searchParams.set('dateTo', queryTo);
      return fetchJson<MatchesResponse>(url.toString(), { headers: { 'X-Auth-Token': apiKey } });
    });

    const conflicts = (data.matches ?? []).filter((match) => teamMatches(input.footballTeam!, match)).flatMap((match) => {
      const matchStart = new Date(match.utcDate);
      const matchEnd = new Date(matchStart.getTime() + 120 * 60_000);
      if (!overlaps(start, end, matchStart, matchEnd)) return [];
      return [{
        id: `fd-${match.id}`,
        type: 'sport' as const,
        title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        description: `${match.competition?.name ?? 'Football'} · ${formatInstant(match.utcDate, timezone)}`,
        impact: 'high' as const,
        source: base.source,
        sourceUrl: base.url,
        preference: defaultPreference('sport', input),
        startsAt: match.utcDate,
        endsAt: matchEnd.toISOString(),
      }];
    });

    return { ...base, state: 'checked', data: conflicts };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: error instanceof Error ? error.message : 'Request failed' };
  }
}
