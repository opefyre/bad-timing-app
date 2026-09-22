import { guard } from '@/lib/api-guard';
import { getJson } from '@/lib/http';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const denied=guard(request);if(denied)return denied;
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2 || q.length > 150) return NextResponse.json({ shows: [] });
  try {
    const response=await getJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,3600000);
    const hits=response.data as Array<{show:{id:number;name:string;premiered?:string;network?:{country?:{name?:string}};webChannel?:{name?:string}}}>;
    if(!Array.isArray(hits))throw new Error('Unexpected programme response');
    return NextResponse.json({ shows: hits.slice(0, 6).map(({ show }) => ({
      id: show.id,
      name: show.name,
      detail: [show.premiered?.slice(0, 4), show.network?.country?.name || show.webChannel?.name].filter(Boolean).join(' · '),
    })) });
  } catch {
    return NextResponse.json({ error: 'TV search failed' }, { status: 502 });
  }
}
