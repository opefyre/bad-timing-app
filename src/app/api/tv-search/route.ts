import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) return NextResponse.json({ shows: [] });
  try {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, { next: { revalidate: 3600 } });
    if (!response.ok) return NextResponse.json({ error: 'TV search failed' }, { status: response.status });
    const hits = await response.json() as Array<{ show: { id: number; name: string; premiered?: string; network?: { country?: { name?: string } }; webChannel?: { name?: string } } }>;
    return NextResponse.json({ shows: hits.slice(0, 6).map(({ show }) => ({
      id: show.id,
      name: show.name,
      detail: [show.premiered?.slice(0, 4), show.network?.country?.name || show.webChannel?.name].filter(Boolean).join(' · '),
    })) });
  } catch {
    return NextResponse.json({ error: 'TV search failed' }, { status: 502 });
  }
}
