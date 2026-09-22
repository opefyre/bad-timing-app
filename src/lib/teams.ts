import { FootballTeam } from '@/types';
import teamsData from '@/config/football-teams.json';

export type TeamSuggestion = FootballTeam & { detail?: string };

type TeamRow = { id: number; name: string; detail?: string };

const index: Array<FootballTeam & { detail: string }> = (teamsData as TeamRow[]).map((team) => ({
  id: team.id,
  name: team.name,
  detail: team.detail ?? '',
}));

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Instant, no-network search over the shipped football-data.org team index.
 * Regenerate the snapshot with `npm run teams`; run-time fan-out would exceed
 * the free plan rate limit.
 */
export async function searchFootballTeams(query: string): Promise<TeamSuggestion[]> {
  const needle = norm(query);
  if (!needle) return [];
  const scored: Array<{ team: (typeof index)[number]; rank: number }> = [];
  for (const team of index) {
    const name = norm(team.name);
    let rank = -1;
    if (name === needle) rank = 0;
    else if (name.startsWith(needle)) rank = 1;
    else if (name.includes(needle)) rank = 2;
    if (rank >= 0) scored.push({ team, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.team.name.localeCompare(b.team.name));
  return scored.slice(0, 6).map(({ team }) => ({ id: team.id, name: team.name, detail: team.detail }));
}