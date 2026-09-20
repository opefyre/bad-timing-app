import { CheckResult } from '@/types';

export async function checkDaylight(lat: number, lng: number, dateTime: string, durationMinutes: number): Promise<CheckResult> {
  try {
    const date = new Date(dateTime).toISOString().split('T')[0];
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return { success: true, data: [], source: 'Sunrise-Sunset API', lastChecked: new Date().toISOString() };
    }

    const sunset = new Date(data.results.sunset);
    const sunrise = new Date(data.results.sunrise);
    const eventStart = new Date(dateTime);
    const eventEnd = new Date(eventStart.getTime() + durationMinutes * 60 * 1000);

    const conflicts = [];

    if (eventStart >= sunset) {
      conflicts.push({
        id: `daylight-after-sunset-${date}`,
        type: 'daylight' as const,
        title: 'Starts after sunset',
        description: `Sunset at ${sunset.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} is before your event begins`,
        impact: 'high' as const,
        source: 'Sunrise-Sunset API',
        sourceUrl: 'https://sunrise-sunset.org',
        preference: 'avoid' as const,
        dateTime: data.results.sunset,
      });
    } else if (eventEnd > sunset) {
      conflicts.push({
        id: `daylight-sunset-${date}`,
        type: 'daylight' as const,
        title: 'Sunset during activity',
        description: `Sunset at ${sunset.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} falls during your event`,
        impact: 'high' as const,
        source: 'Sunrise-Sunset API',
        sourceUrl: 'https://sunrise-sunset.org',
        preference: 'avoid' as const,
        dateTime: data.results.sunset,
      });
    }

    if (eventStart < sunrise) {
      conflicts.push({
        id: `daylight-sunrise-${date}`,
        type: 'daylight' as const,
        title: 'Before sunrise',
        description: `Sunrise at ${sunrise.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} is after your event starts`,
        impact: 'medium' as const,
        source: 'Sunrise-Sunset API',
        sourceUrl: 'https://sunrise-sunset.org',
        preference: 'avoid' as const,
        dateTime: data.results.sunrise,
      });
    }

    return { success: true, data: conflicts, source: 'Sunrise-Sunset API', lastChecked: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', source: 'Sunrise-Sunset API', lastChecked: new Date().toISOString() };
  }
}
