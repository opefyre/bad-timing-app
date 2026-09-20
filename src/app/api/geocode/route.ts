import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Geoapify API key not configured' }, { status: 500 });
  if (!q || q.trim().length < 2) return NextResponse.json({ suggestions: [] });

  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.searchParams.append('text', q.trim());
  url.searchParams.append('limit', '6');
  url.searchParams.append('apiKey', apiKey);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: 'Geocoding failed' }, { status: res.status });
    const data = await res.json();
    const suggestions = (data.features ?? []).map((f: { properties: Record<string, unknown>; geometry: { coordinates: number[] } }) => ({
      id: String(f.properties.place_id ?? Math.random()),
      label: String(f.properties.formatted ?? ''),
      formatted: String(f.properties.formatted ?? ''),
      name: f.properties.name ? String(f.properties.name) : undefined,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 });
  }
}