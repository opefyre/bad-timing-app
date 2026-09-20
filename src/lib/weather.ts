import { CheckResult } from '@/types';

export async function checkWeather(lat: number, lng: number, dateTime: string): Promise<CheckResult> {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'BadTimingApp/1.0 github.com/bad-timing' } });
    const data = await response.json();

    if (!data.properties?.timeseries) {
      return { success: true, data: [], source: 'MET Norway Locationforecast', lastChecked: new Date().toISOString() };
    }

    const targetDate = new Date(dateTime).toISOString().split('T')[0];
    const targetHour = new Date(dateTime).getHours();

    const relevantEntries = data.properties.timeseries.filter((entry: { time: string }) => {
      const entryDate = new Date(entry.time).toISOString().split('T')[0];
      const entryHour = new Date(entry.time).getHours();
      return entryDate === targetDate && Math.abs(entryHour - targetHour) <= 2;
    });

    const conflicts = relevantEntries.map((entry: { time: string; data: { instant: { details: { air_temperature: number; wind_speed: number } }; next_1_hours?: { details: { precipitation_amount: number } } } }) => {
      const temp = entry.data.instant.details.air_temperature;
      const wind = entry.data.instant.details.wind_speed;
      const precipitation = entry.data.next_1_hours?.details?.precipitation_amount || 0;

      const issues: string[] = [];
      if (precipitation > 0.5) issues.push('rain');
      if (wind > 10) issues.push('strong wind');
      if (temp < 5) issues.push('cold');
      if (temp > 30) issues.push('hot');

      return {
        id: `weather-${entry.time}`,
        type: 'weather' as const,
        title: issues.length ? `Weather warning: ${issues.join(', ')}` : 'Weather looks good',
        description: `${temp}°C, wind ${wind} m/s, ${precipitation}mm precipitation expected`,
        impact: issues.length > 0 ? (precipitation > 2 ? ('high' as const) : ('medium' as const)) : ('low' as const),
        source: 'MET Norway Locationforecast',
        sourceUrl: 'https://api.met.no/weatherapi/locationforecast/2.0',
        preference: issues.length ? 'avoid' as const : 'neutral' as const,
        dateTime: entry.time,
      };
    });

    return { success: true, data: conflicts.filter((c: { impact: string }) => c.impact !== 'low'), source: 'MET Norway Locationforecast', lastChecked: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', source: 'MET Norway Locationforecast', lastChecked: new Date().toISOString() };
  }
}
