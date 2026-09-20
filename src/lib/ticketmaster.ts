import { CheckResult } from '@/types';

export async function checkTicketmaster(
  lat: number,
  lng: number,
  dateTime: string,
  radiusKm: number = 10
): Promise<CheckResult> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'Ticketmaster API key not configured', source: 'Ticketmaster Discovery API', lastChecked: new Date().toISOString() };
  }

  try {
    const startDateTime = new Date(dateTime).toISOString();
    const endDateTime = new Date(new Date(dateTime).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
    url.searchParams.append('apikey', apiKey);
    url.searchParams.append('latlong', `${lat},${lng}`);
    url.searchParams.append('radius', radiusKm.toString());
    url.searchParams.append('unit', 'km');
    url.searchParams.append('startDateTime', startDateTime);
    url.searchParams.append('endDateTime', endDateTime);
    url.searchParams.append('size', '20');
    url.searchParams.append('sort', 'distance,asc');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!data._embedded?.events) {
      return { success: true, data: [], source: 'Ticketmaster Discovery API', lastChecked: new Date().toISOString() };
    }

    const conflicts = data._embedded.events.map((event: { name: string; dates: { start: { localDate: string; localTime: string } }; _embedded: { venues: { distance: { value: number } }[] }; url: string }) => ({
      id: `tm-${event.name}-${event.dates.start.localDate}`,
      type: 'nearby_event' as const,
      title: event.name,
      description: `Event at ${event.dates.start.localTime} on ${event.dates.start.localDate}`,
      impact: 'medium' as const,
      source: 'Ticketmaster Discovery API',
      sourceUrl: event.url,
      preference: 'neutral' as const,
      dateTime: `${event.dates.start.localDate}T${event.dates.start.localTime}`,
      distance: event._embedded.venues?.[0]?.distance?.value,
    }));

    return { success: true, data: conflicts, source: 'Ticketmaster Discovery API', lastChecked: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', source: 'Ticketmaster Discovery API', lastChecked: new Date().toISOString() };
  }
}
