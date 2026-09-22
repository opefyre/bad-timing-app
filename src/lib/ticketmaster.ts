import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson } from './http';
import { eventWindow, formatInstant } from './time';
import { defaultPreference } from './preferences';
import { geohash, haversineKm } from './geo';

type TMEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { dateTime?: string; localDate?: string; localTime?: string }; end?: { dateTime?: string } };
  _embedded?: { venues?: Array<{ name?: string; location?: { latitude?: string; longitude?: string } }> };
};

type TMResponse = { _embedded?: { events?: TMEvent[] } };

export async function checkTicketmaster(input: EventInput, radiusKm = 8): Promise<CheckResult> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  const checkedAt = new Date().toISOString();
  const base = { source: 'Ticketmaster Discovery API', sourceId: 'ticketmaster', url: 'https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/', lastChecked: checkedAt };
  if (!apiKey) return { ...base, state: 'unavailable', data: [], message: 'API key not configured' };
  const { lat, lng, timezone } = input.venue;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !timezone) return { ...base, state: 'not_applicable', data: [], message: 'Location or timezone unavailable' };

  try {
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const from = new Date(start.getTime() - 2 * 60 * 60_000);
    const to = new Date(end.getTime() + 2 * 60 * 60_000);
    const key = `ticketmaster:${lat.toFixed(3)}:${lng.toFixed(3)}:${from.toISOString().slice(0, 13)}:${to.toISOString().slice(0, 13)}`;
    const data = await cached(key, 10 * 60_000, async () => {
      const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
      url.searchParams.set('apikey', apiKey);
      url.searchParams.set('geoPoint', geohash(lat, lng));
      url.searchParams.set('radius', String(radiusKm));
      url.searchParams.set('unit', 'km');
      url.searchParams.set('startDateTime', from.toISOString());
      url.searchParams.set('endDateTime', to.toISOString());
      url.searchParams.set('size', '20');
      url.searchParams.set('sort', 'distance,asc');
      return fetchJson<TMResponse>(url.toString());
    });

    const conflicts = (data._embedded?.events ?? []).map((event) => {
      const venue = event._embedded?.venues?.[0];
      const venueLat = Number(venue?.location?.latitude);
      const venueLng = Number(venue?.location?.longitude);
      const distanceKm = Number.isFinite(venueLat) && Number.isFinite(venueLng) ? haversineKm(lat, lng, venueLat, venueLng) : undefined;
      const startsAt = event.dates?.start?.dateTime;
      const time = startsAt ? formatInstant(startsAt, timezone, { hour: '2-digit', minute: '2-digit' }) : event.dates?.start?.localTime?.slice(0, 5) ?? 'time TBA';
      const where = venue?.name ? ` at ${venue.name}` : '';
      const distance = typeof distanceKm === 'number' ? ` · ${distanceKm.toFixed(distanceKm < 2 ? 1 : 0)} km away` : '';
      return {
        id: `tm-${event.id}`,
        type: 'nearby_event' as const,
        title: event.name,
        description: `${time}${where}${distance}`,
        impact: (typeof distanceKm === 'number' && distanceKm <= 1.5 ? 'medium' : 'low') as 'medium' | 'low',
        source: base.source,
        sourceUrl: event.url,
        preference: defaultPreference('nearby_event', input),
        startsAt,
        endsAt: event.dates?.end?.dateTime,
        distanceKm,
        placeName: venue?.name,
      };
    });
    return { ...base, state: 'checked', data: conflicts };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: error instanceof Error ? error.message : 'Request failed' };
  }
}
