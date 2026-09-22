import { guard } from '@/lib/api-guard';
import { searchFootballTeams } from '@/lib/teams';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const denied = guard(request); if (denied) return denied;
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2 || q.length > 150) return NextResponse.json({ teams: [] });
  try {
    return NextResponse.json({ teams: await searchFootballTeams(q) });
  } catch {
    return NextResponse.json({ error: 'Team search failed' }, { status: 502 });
  }
}
