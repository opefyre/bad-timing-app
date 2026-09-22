import { guard } from '@/lib/api-guard';
import { NextRequest, NextResponse } from 'next/server';

type Feature = {
  properties: {
    place_id?: string;
    formatted?: string;
    name?: string;
    country_code?: string;
    state?: string;
    state_code?: string;
    country?: string;
    city?: string;
    timezone?: { name?: string };
  };
  geometry: { coordinates: [number, number] };
};

function toVenue(feature: Feature) {
  return {
    address: feature.properties.formatted ?? `${feature.geometry.coordinates[1]}, ${feature.geometry.coordinates[0]}`,
    name: feature.properties.name,
    lat: feature.geometry.coordinates[1],
    lng: feature.geometry.coordinates[0],
    timezone: feature.properties.timezone?.name,
    countryCode: feature.properties.country_code,
    state: feature.properties.state,
    subdivisionCode: feature.properties.state_code,
    countryName: feature.properties.country,
    city: feature.properties.city,
  };
}

export async function GET(request: NextRequest) {
  const denied=guard(request);if(denied)return denied;
  if((request.nextUrl.searchParams.get('q')?.length??0)>500)return NextResponse.json({error:'Search is too long'},{status:400});
  const q = request.nextUrl.searchParams.get('q')?.trim();
  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lng = Number(request.nextUrl.searchParams.get('lng'));
  const hasCoordinates = request.nextUrl.searchParams.has('lat') && request.nextUrl.searchParams.has('lng') && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) return NextResponse.json({ error: 'Location service is not configured' }, { status: 503 });

  try {
    if (hasCoordinates) {
      const url = new URL('https://api.geoapify.com/v1/geocode/reverse');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lng));
      url.searchParams.set('limit', '1');
      url.searchParams.set('apiKey', apiKey);
      const res = await fetch(url.toString(), { cache: 'no-store', signal:AbortSignal.timeout(8000),redirect:'error' });
      if (!res.ok) return NextResponse.json({ error: 'Could not identify this point' }, { status: res.status });
      const data = await res.json() as { features?: Feature[] };
      const feature = data.features?.[0];
      if (!feature) return NextResponse.json({ error: 'Could not identify this point' }, { status: 404 });
      return NextResponse.json({ location: toVenue(feature) });
    }

    if (!q || q.length < 2) return NextResponse.json({ suggestions: [] });
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
    url.searchParams.set('text', q);
    url.searchParams.set('limit', '7');
    url.searchParams.set('apiKey', apiKey);

    const res = await fetch(url.toString(), { cache: 'no-store', signal:AbortSignal.timeout(8000),redirect:'error' });
    if (!res.ok) return NextResponse.json({ error: 'Location search failed' }, { status: res.status });
    const data = await res.json() as { features?: Feature[] };
    const suggestions = (data.features ?? []).map((feature, index) => ({
      id: feature.properties.place_id ?? `result-${index}`,
      label: feature.properties.formatted ?? '',
      ...toVenue(feature),
    }));
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: 'Location service is unavailable' }, { status: 502 });
  }
}
