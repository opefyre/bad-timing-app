import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson } from './http';
import { eventWindow, formatInstant, localDate } from './time';
import { defaultPreference } from './preferences';

type SunResponse = {
  date?: string;
  tzid?: string;
  sunrise?: string | null;
  sunset?: string | null;
  error?: string;
  message?: string;
};

export async function checkDaylight(input: EventInput): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { source: 'Sunrise-Sunset API', sourceId: 'daylight', url: 'https://sunrise-sunset.org/api', lastChecked: checkedAt };
  if (!input.isOutdoor) return { ...base, state: 'not_applicable', data: [], message: 'Indoor event' };
  const { lat, lng, timezone } = input.venue;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !timezone) return { ...base, state: 'not_applicable', data: [], message: 'Location or timezone unavailable' };

  try {
    const date = localDate(input.dateTime);
    const data = await cached(`sun:${lat.toFixed(3)}:${lng.toFixed(3)}:${date}`, 12 * 60 * 60_000, () => fetchJson<SunResponse>(`https://api.sunrise-sunset.org/v2?lat=${lat}&lng=${lng}&date=${date}&tz=${encodeURIComponent(timezone)}`));
    if (!data.sunrise || !data.sunset) return { ...base, state: 'out_of_range', data: [], message: data.message || 'Sunrise or sunset unavailable for this date/location' };
    const sunrise = new Date(data.sunrise);
    const sunset = new Date(data.sunset);
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const conflicts = [];
    if (start >= sunset) {
      conflicts.push({
        id: `daylight-after-${date}`, type: 'daylight' as const, title: 'Starts after sunset',
        description: `Sunset is ${formatInstant(sunset.toISOString(), timezone, { hour: '2-digit', minute: '2-digit' })}`,
        impact: 'high' as const, source: base.source, sourceUrl: base.url,
        preference: defaultPreference('daylight', input), startsAt: sunset.toISOString(),
      });
    } else if (end > sunset) {
      conflicts.push({
        id: `daylight-during-${date}`, type: 'daylight' as const, title: 'Sunset lands inside your event',
        description: `Sunset is ${formatInstant(sunset.toISOString(), timezone, { hour: '2-digit', minute: '2-digit' })}`,
        impact: 'high' as const, source: base.source, sourceUrl: base.url,
        preference: defaultPreference('daylight', input), startsAt: sunset.toISOString(),
      });
    }
    if (start < sunrise) {
      conflicts.push({
        id: `daylight-before-${date}`, type: 'daylight' as const, title: 'Starts before sunrise',
        description: `Sunrise is ${formatInstant(sunrise.toISOString(), timezone, { hour: '2-digit', minute: '2-digit' })}`,
        impact: 'medium' as const, source: base.source, sourceUrl: base.url,
        preference: defaultPreference('daylight', input), startsAt: sunrise.toISOString(),
      });
    }
    return { ...base, state: 'checked', data: conflicts };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: error instanceof Error ? error.message : 'Request failed' };
  }
}
