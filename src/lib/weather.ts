import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson } from './http';
import { eventWindow } from './time';
import { defaultPreference } from './preferences';

type Series = {
  time: string;
  data: {
    instant: { details: { air_temperature: number; wind_speed: number } };
    next_1_hours?: { details?: { precipitation_amount?: number } };
  };
};
type Forecast = { properties?: { timeseries?: Series[] } };

export async function checkWeather(input: EventInput): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { source: 'MET Norway Locationforecast', sourceId: 'weather', url: 'https://api.met.no/weatherapi/locationforecast/2.0/', lastChecked: checkedAt };
  const { lat, lng, timezone } = input.venue;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !timezone) return { ...base, state: 'not_applicable', data: [], message: 'Location or timezone unavailable' };

  try {
    const safeLat = Number(lat.toFixed(4));
    const safeLng = Number(lng.toFixed(4));
    const userAgent = process.env.MET_USER_AGENT;
    if (!userAgent) return { ...base, state: 'unavailable', data: [], message: 'MET_USER_AGENT is not configured' };
    const data = await cached(`met:${safeLat}:${safeLng}`, 15 * 60_000, () => fetchJson<Forecast>(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${safeLat}&lon=${safeLng}`,
      { headers: { 'User-Agent': userAgent } },
    ));
    const series = data.properties?.timeseries ?? [];
    if (!series.length) return { ...base, state: 'unavailable', data: [], message: 'Forecast returned no timeseries' };
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const first = new Date(series[0].time);
    const last = new Date(series[series.length - 1].time);
    if (start < new Date(first.getTime() - 60 * 60_000) || start > new Date(last.getTime() + 60 * 60_000)) {
      return { ...base, state: 'out_of_range', data: [], message: `Forecast currently covers through ${last.toISOString().slice(0, 10)}` };
    }
    const relevant = series.filter((entry) => {
      const t = new Date(entry.time).getTime();
      return t >= start.getTime() - 30 * 60_000 && t <= end.getTime() + 60 * 60_000;
    });
    if (!relevant.length) return { ...base, state: 'out_of_range', data: [], message: 'No forecast point covers this event window' };

    const temps = relevant.map((e) => e.data.instant.details.air_temperature);
    const winds = relevant.map((e) => e.data.instant.details.wind_speed);
    const rain = relevant.map((e) => e.data.next_1_hours?.details?.precipitation_amount ?? 0);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const maxWind = Math.max(...winds);
    const maxRain = Math.max(...rain);
    const issues: string[] = [];
    if (maxRain >= 0.5) issues.push(`${maxRain.toFixed(1)} mm/h rain`);
    if (maxWind >= 10) issues.push(`${maxWind.toFixed(0)} m/s wind`);
    if (minTemp <= 4) issues.push(`${minTemp.toFixed(0)}°C cold`);
    if (maxTemp >= 30) issues.push(`${maxTemp.toFixed(0)}°C heat`);
    if (!issues.length) return { ...base, state: 'checked', data: [] };

    const impact = maxRain >= 2 || maxWind >= 15 || minTemp <= 0 || maxTemp >= 35 ? 'high' as const : 'medium' as const;
    return { ...base, state: 'checked', data: [{
      id: `weather-${input.dateTime.slice(0, 13)}`,
      type: 'weather',
      title: 'Outdoor conditions worth checking',
      description: issues.join(' · '),
      impact,
      source: base.source,
      sourceUrl: base.url,
      preference: defaultPreference('weather', input),
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    }] };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: error instanceof Error ? error.message : 'Request failed' };
  }
}
