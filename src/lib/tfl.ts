import { CheckResult } from '@/types';

export async function checkTfLDisruptions(lat: number, lng: number, dateTime: string): Promise<CheckResult> {
  try {
    const url = `https://api.tfl.gov.uk/Place?lat=${lat}&lon=${lng}&radius=1000&type=StopPoint`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.length) {
      return { success: true, data: [], source: 'Transport for London', lastChecked: new Date().toISOString() };
    }

    const stopIds = data.filter((place: { stopPoint?: { indicator?: string } }) => place.stopPoint?.indicator).map((place: { id: string }) => place.id).slice(0, 5);
    const disruptions = [];

    for (const stopId of stopIds) {
      try {
        const disruptionUrl = `https://api.tfl.gov.uk/Place/${stopId}/Disruptions`;
        const disruptionResponse = await fetch(disruptionUrl);
        const disruptionData = await disruptionResponse.json();

        for (const disruption of disruptionData) {
          disruptions.push({
            id: `tfl-${stopId}-${disruption.id || Date.now()}`,
            type: 'transport' as const,
            title: disruption.categoryDescription || 'Transport disruption',
            description: disruption.description || 'Disruption reported',
            impact: 'medium' as const,
            source: 'Transport for London',
            sourceUrl: 'https://tfl.gov.uk',
            preference: 'avoid' as const,
            dateTime: disruption.validityPeriods?.[0]?.from || dateTime,
          });
        }
      } catch {
        continue;
      }
    }

    return { success: true, data: disruptions, source: 'Transport for London', lastChecked: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', source: 'Transport for London', lastChecked: new Date().toISOString() };
  }
}
