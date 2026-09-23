import { guard } from '@/lib/api-guard';
import { searchFootballTeams } from '@/lib/teams';
import { searchApiFootballTeams } from '@/lib/api-football';
import { searchEspnFootballTeams } from '@/lib/espn-football';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const denied = guard(request); if (denied) return denied;
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2 || q.length > 150) return NextResponse.json({ teams: [] });
  try {
    const [fd, af, espn] = await Promise.all([searchFootballTeams(q), searchApiFootballTeams(q), searchEspnFootballTeams(q)]);
    const seen = new Set<string>();
    const teams = [
      ...fd.map((team) => ({ ...team, source: 'football-data' as const })),
      ...espn.map((team) => ({ ...team, source: 'espn' as const })),
      ...af.map((team) => ({ ...team, source: 'api-football' as const })),
    ];
    const merged = [];
    for (const team of teams) {
      const key = team.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/^(fc|cf|sc|ac|cd|cr|cl|csc|afc|us|as|sv|vfb|vfl|tsg|rcd|rc) /, '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(team);
    }
    return NextResponse.json({ teams: merged.slice(0, 12) });
  } catch {
    return NextResponse.json({ error: 'Team search failed' }, { status: 502 });
  }
}
