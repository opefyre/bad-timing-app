import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson, HttpError, safeMessage } from './http';
import { eventWindow, formatInstant, overlaps } from './time';
import { defaultPreference } from './preferences';
import { TeamSuggestion } from './teams';
import espnData from '@/config/espn-teams.json';

type EspnRow = { id: string; name: string; norm: string; aliases: string[]; league: string; country: string };
type EspnLeague = { slug: string; name: string; country: string };

const rowIndex: EspnRow[] = (espnData as { leagues: EspnLeague[]; teams: EspnRow[] }).teams;
const leagueIndex = new Map<string, EspnLeague>((espnData as { leagues: EspnLeague[] }).leagues.map((league) => [league.slug, league]));

function norm(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Instant, no-network search over the shipped ESPN team snapshot (see
 * `npm run teams-espn`). ESPN is a free, current-season source.
 */
export async function searchEspnFootballTeams(query: string): Promise<TeamSuggestion[]> {
  const needle = norm(query);
  if (!needle) return [];
  const scored: Array<{ row: EspnRow; rank: number }> = [];
  for (const row of rowIndex) {
    const options = [row.norm, ...row.aliases];
    let rank = -1;
    for (const candidate of options) {
      if (candidate === needle) rank = 0;
      else if (rank < 0 && candidate.startsWith(needle)) rank = 1;
      else if (rank < 0 && candidate.includes(needle)) rank = 2;
    }
    if (rank >= 0) scored.push({ row, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.row.name.localeCompare(b.row.name));
  return scored.slice(0, 6).map(({ row }) => {
    const league = leagueIndex.get(row.league);
    return { id: Number(row.id) || 0, name: row.name, detail: [league?.name, row.country, 'ESPN'].filter(Boolean).join(' · ') };
  });
}

/** The part of the group's selections that should be checked by ESPN's scoreboards. */
export function espnFootballSelections(input: EventInput) {
  return (input.footballTeams ?? []).filter((team) => team.source === 'espn');
}

type EspnCompetitor = { homeAway?: string; team?: { id?: string | number; displayName?: string } };
type EspnEvent = { id?: string | number; date?: string; competitions?: Array<{ competitors?: EspnCompetitor[] }> };
type EspnScoreboard = { events?: EspnEvent[] };

export async function checkFootballEspn(input: EventInput): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { source: 'ESPN', sourceId: 'football-espn', url: 'https://www.espn.com/soccer/', lastChecked: checkedAt };
  const picked = espnFootballSelections(input);
  if (!picked.length) return { ...base, state: 'not_applicable', data: [], message: 'No ESPN team selected' };
  const timezone = input.venue.timezone;
  if (!timezone) return { ...base, state: 'unavailable', data: [], message: 'Venue timezone unavailable' };

  const byId = new Map<string, EspnRow>(rowIndex.map((row) => [row.id, row]));
  const byName = new Map<string, EspnRow>(rowIndex.map((row) => [row.norm, row]));
  const resolve = (team: { id?: number; name: string }) => {
    if (typeof team.id === 'number' && team.id > 0) {
      const row = byId.get(String(team.id));
      if (row) return row;
    }
    return byName.get(norm(team.name));
  };

  try {
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const date = start.toISOString().slice(0, 10).replace(/-/g, '');
    const data: CheckResult['data'] = [];
    const reasons: string[] = [];
    const uncovered = picked.filter((team) => !resolve(team));
    if (uncovered.length && uncovered.length === picked.length) {
      return { ...base, state: 'partial', data: [], message: 'None of the selections map to the free ESPN index; choose from the team suggestions.' };
    }
    const leagues = [...new Set(picked.map((team) => resolve(team)?.league).filter(Boolean))] as string[];
    for (const slug of leagues) {
      try {
        const scoreboard = await cached<EspnScoreboard>(`espn:scoreboard:${slug}:${date}`, 3 * 3600_000, async () =>
          fetchJson<EspnScoreboard>(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date}`),
        );
        const league = leagueIndex.get(slug);
        for (const event of scoreboard.events ?? []) {
          if (typeof event.id === 'undefined' || !event.date) continue;
          const matchStart = new Date(event.date);
          if (!Number.isFinite(matchStart.getTime())) continue;
          const participants = event.competitions?.[0]?.competitors ?? [];
          const byInvolvedTeam = picked.some((team) => {
            const row = resolve(team);
            if (!row) return false;
            return participants.some((c) => String(c.team?.id) === row.id || (c.team?.displayName && norm(c.team.displayName) === row.norm));
          });
          if (!byInvolvedTeam) continue;
          const matchEnd = new Date(matchStart.getTime() + 120 * 60_000);
          if (!overlaps(start, end, matchStart, matchEnd)) continue;
          const home = participants.find((c) => c.homeAway === 'home')?.team?.displayName ?? 'Unknown';
          const away = participants.find((c) => c.homeAway === 'away')?.team?.displayName ?? 'Unknown';
          data.push({
            id: `espn-${event.id}`,
            type: 'sport' as const,
            title: `${home} vs ${away}`,
            description: `${league?.name ?? 'Football'} · ${formatInstant(event.date, timezone)} · ESPN`,
            impact: 'high' as const,
            source: base.source,
            sourceUrl: base.url,
            preference: defaultPreference('sport', input),
            startsAt: event.date,
            endsAt: matchEnd.toISOString(),
            providerId: 'football',
            evidence: 'structured' as const,
            timing: 'scheduled' as const,
            relevance: 'overlap' as const,
            resolutionEligible: true,
            caveat: 'A two-hour match window is estimated from kickoff seen in a scheduled scoreboard. Extra time and schedule changes can extend it.',
          });
        }
      } catch (error) {
        reasons.push(error instanceof HttpError ? safeMessage(error) : error instanceof Error ? error.message : safeMessage(error));
      }
    }
    if (reasons.length === leagues.length) {
      return { ...base, state: 'unavailable', data: [], message: [...new Set(reasons)].join(' · ') };
    }
    return {
      ...base,
      state: reasons.length || uncovered.length ? 'partial' : 'checked',
      data,
      message: [
        reasons.length ? `Some leagues could not be confirmed. ${[...new Set(reasons)].join(' · ')}` : null,
        uncovered.length ? 'Some selections are outside the free ESPN index.' : null,
        !reasons.length && !uncovered.length ? 'Free current-season scoreboards for the event date.' : null,
      ].filter(Boolean).join(' '),
    };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: safeMessage(error) };
  }
}