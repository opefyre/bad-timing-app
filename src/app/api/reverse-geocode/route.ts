import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const latParam = request.nextUrl.searchParams.get('lat');
  const lngParam = request.nextUrl.searchParams.get('lng');
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey || !latParam || !lngParam) return NextResponse.json({ error: 'missing params' }, { status: 400 });

  const lat = Number(latParam);
  const lng = Number(lngParam);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: 'invalid coords' }, { status: 400 });

  const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
  url.searchParams.append('lat', String(lat));
  url.searchParams.append('lon', String(lng));
  url.searchParams.append('apiKey', apiKey);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: 'reverse geocoding failed' }, { status: res.status });
    const data = await res.json();
    const props = data.features?.[0]?.properties;
    if (!props) return NextResponse.json({ formatted: null, name: null });
    return NextResponse.json({
      formatted: props.formatted ?? null,
      name: props.name ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'reverse geocoding failed' }, { status: 502 });
  }
}