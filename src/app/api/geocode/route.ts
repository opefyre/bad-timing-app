import { NextRequest, NextResponse } from 'next/server';

type Feature = {
  properties: {
    place_id?: string;
    formatted?: string;
    name?: string;
    country_code?: string;
    state?: string;
    city?: string;
    timezone?: { name?: string };
  };
  geometry: { coordinates: [number, number] };
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Geoapify API key not configured' }, { status: 500 });
  if (!q || q.trim().length < 2) return NextResponse.json({ suggestions: [] });

  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.searchParams.set('text', q.trim());
  url.searchParams.set('limit', '7');
  url.searchParams.set('apiKey', apiKey);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: 'Geocoding failed' }, { status: res.status });
    const data = await res.json() as { features?: Feature[] };
    const suggestions = (data.features ?? []).map((feature, index) => ({
      id: feature.properties.place_id ?? `result-${index}`,
      label: feature.properties.formatted ?? '',
      name: feature.properties.name,
      lat: feature.geometry.coordinates[1],
      lng: feature.geometry.coordinates[0],
      timezone: feature.properties.timezone?.name,
      countryCode: feature.properties.country_code,
      state: feature.properties.state,
      city: feature.properties.city,
    }));
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 });
  }
}
