import { VenueInput } from '@/types';
import { fetchJson } from './http';

type GeoFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    formatted?: string;
    name?: string;
    country_code?: string;
    state?: string;
    city?: string;
    place_id?: string;
    timezone?: { name?: string };
  };
};
type GeoResponse = { features?: GeoFeature[] };

export async function geocodeVenue(address: string): Promise<VenueInput> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error('Geoapify API key not configured');
  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('text', address);
  url.searchParams.set('limit', '1');
  url.searchParams.set('apiKey', apiKey);
  const data = await fetchJson<GeoResponse>(url.toString());
  const feature = data.features?.[0];
  if (!feature) throw new Error('Location not found');
  const [lng, lat] = feature.geometry.coordinates;
  return {
    address: feature.properties.formatted || address,
    name: feature.properties.name,
    lat,
    lng,
    timezone: feature.properties.timezone?.name,
    countryCode: feature.properties.country_code,
    state: feature.properties.state,
    city: feature.properties.city,
  };
}
