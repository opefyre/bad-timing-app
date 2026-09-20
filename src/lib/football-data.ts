import { CheckResult } from '@/types';

export async function checkFootballData(team: string, dateTime: string): Promise<CheckResult> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Football Data API key not configured', source: 'football-data.org', lastChecked: new Date().toISOString() };
  }

  try {
    const startDate = new Date(dateTime).toISOString().split('T')[0];
    const endDate = new Date(new Date(dateTime).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const url = new URL('https://api.football-data.org/v4/matches');
    url.searchParams.append('dateFrom', startDate);
    url.searchParams.append('dateTo', endDate);

    const response = await fetch(url.toString(), { headers: { 'X-Auth-Token': apiKey } });
    const data = await response.json();

    if (!data.matches) {
      return { success: true, data: [], source: 'football-data.org', lastChecked: new Date().toISOString() };
    }

    const teamLower = team.toLowerCase();
    const matches = data.matches.filter((match: { homeTeam: { name: string; shortName: string }; awayTeam: { name: string; shortName: string } }) =>
      match.homeTeam.name.toLowerCase().includes(teamLower) || match.homeTeam.shortName.toLowerCase().includes(teamLower) ||
      match.awayTeam.name.toLowerCase().includes(teamLower) || match.awayTeam.shortName.toLowerCase().includes(teamLower)
    );

    const conflicts = matches.map((match: { id: number; homeTeam: { name: string }; awayTeam: { name: string }; utcDate: string; competition: { name: string } }) => ({
      id: `fd-${match.id}`,
      type: 'sport' as const,
      title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      description: `${match.competition.name} match on ${new Date(match.utcDate).toLocaleString()}`,
      impact: 'high' as const,
      source: 'football-data.org',
      sourceUrl: 'https://www.football-data.org',
      preference: 'avoid' as const,
      dateTime: match.utcDate,
    }));

    return { success: true, data: conflicts, source: 'football-data.org', lastChecked: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', source: 'football-data.org', lastChecked: new Date().toISOString() };
  }
}
