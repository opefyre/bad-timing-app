import { CheckResult, Conflict, EventInput, Report, SourceStatus } from '@/types';
import { geocodeVenue } from './geocoding';
import { checkTicketmaster } from './ticketmaster';
import { checkFootballData } from './football-data';
import { checkWeather } from './weather';
import { checkDaylight } from './daylight';
import { checkTVmaze } from './tvmaze';
import { checkBankHolidays } from './bank-holidays';
import { checkTfLDisruptions } from './tfl';

function sourceStatus(result: CheckResult): SourceStatus {
  return {
    id: result.sourceId,
    name: result.source,
    url: result.url,
    state: result.state,
    checkedAt: result.lastChecked,
    message: result.message,
  };
}

function impactRank(impact: Conflict['impact']) {
  return impact === 'high' ? 0 : impact === 'medium' ? 1 : 2;
}

export interface AnalysisContext { siteOrigin?: string }

export async function analyzeEvent(rawInput: EventInput, context: AnalysisContext = {}): Promise<Report> {
  let input: EventInput = { ...rawInput, venue: { ...rawInput.venue } };
  let geoStatus: SourceStatus;
  const checkedAt = new Date().toISOString();

  const needsGeocoding = typeof input.venue.lat !== 'number' || typeof input.venue.lng !== 'number' || !input.venue.timezone || !input.venue.countryCode;
  if (needsGeocoding) {
    try {
      const venue = await geocodeVenue(input.venue.address);
      input = { ...input, venue: { ...venue, name: input.venue.name || venue.name } };
      geoStatus = { id: 'geoapify', name: 'Geoapify', url: 'https://www.geoapify.com/', state: 'checked', checkedAt };
    } catch (error) {
      geoStatus = { id: 'geoapify', name: 'Geoapify', url: 'https://www.geoapify.com/', state: 'unavailable', checkedAt, message: error instanceof Error ? error.message : 'Geocoding failed' };
    }
  } else {
    geoStatus = { id: 'geoapify', name: 'Geoapify', url: 'https://www.geoapify.com/', state: 'checked', checkedAt };
  }

  const results = await Promise.all([
    checkTicketmaster(input),
    checkFootballData(input),
    checkTVmaze(input),
    checkBankHolidays(input),
    checkWeather(input, context.siteOrigin),
    checkDaylight(input),
    checkTfLDisruptions(input),
  ]);

  const conflicts = results.flatMap((result) => result.data).sort((a, b) => {
    const impact = impactRank(a.impact) - impactRank(b.impact);
    if (impact !== 0) return impact;
    if (a.startsAt && b.startsAt) return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    return a.title.localeCompare(b.title);
  });
  const sources = [geoStatus, ...results.map(sourceStatus)];
  const coverageGaps = sources
    .filter((source) => source.state === 'unavailable' || source.state === 'out_of_range')
    .map((source) => source.name);

  return { event: input, conflicts, suggestions: [], checkedAt: new Date().toISOString(), sources, coverageGaps };
}
