import { safeMessage } from './http';
import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson } from './http';
import { defaultPreference } from './preferences';
import { addLocalDays, localDate, zonedLocalToUtc } from './time';

type Holiday = { title: string; date: string; notes?: string };
type HolidayFeed = Record<string, { division: string; events: Holiday[] }>;

function regionFor(input: EventInput): string | null {
  if (input.venue.countryCode?.toLowerCase() !== 'gb') return null;
  const state = input.venue.state?.toLowerCase() ?? '';
  if (state.includes('scotland')||input.venue.subdivisionCode==='GB-SCT') return 'scotland';
  if (state.includes('northern ireland')||input.venue.subdivisionCode==='GB-NIR') return 'northern-ireland';
  if(state.includes('england')||state.includes('wales')||['GB-ENG','GB-WLS'].includes(input.venue.subdivisionCode??''))return 'england-and-wales';
  return null;
}

export async function checkBankHolidays(input: EventInput): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { source: 'GOV.UK Bank Holidays', sourceId: 'bank-holidays', url: 'https://www.gov.uk/bank-holidays', lastChecked: checkedAt };
  const region = regionFor(input);
  if (!region) return { ...base, state:input.venue.countryCode?.toLowerCase()==='gb'?'partial':'not_applicable', data: [], message:input.venue.countryCode?.toLowerCase()==='gb'?'UK subdivision could not be matched':'UK only' };

  try {
    const data = await cached('govuk-bank-holidays', 12 * 60 * 60_000, () => fetchJson<HolidayFeed>('https://www.gov.uk/bank-holidays.json'));
    const target = localDate(input.dateTime);
    const previous = localDate(addLocalDays(input.dateTime, -1));
    const next = localDate(addLocalDays(input.dateTime, 1));
    const events = data[region]?.events;if(!Array.isArray(events))throw new Error('Calendar missing');
    const years=events.map(e=>Number(e.date.slice(0,4))).filter(Number.isFinite);
    if(!years.length||Number(target.slice(0,4))<Math.min(...years)||Number(target.slice(0,4))>Math.max(...years))return {...base,state:'out_of_range',data:[],message:'This year is not in the published calendar'};
    const conflicts = events.flatMap((holiday) => {
      const exact = holiday.date === target;
      const adjacent = holiday.date === previous || holiday.date === next;
      if (!exact && !adjacent) return [];
      return [{
        id: `bh-${region}-${holiday.date}`,
        type: 'holiday' as const,
        title: exact ? holiday.title : `Adjacent to ${holiday.title}`,
        description: exact ? (holiday.notes || 'UK bank holiday') : `The event sits next to the ${holiday.title} bank holiday`,
        impact: exact ? 'medium' as const : 'low' as const,
        source: base.source,
        sourceUrl: base.url,
        preference: defaultPreference('holiday', input),
        startsAt:zonedLocalToUtc(`${holiday.date}T00:00`,input.venue.timezone!).toISOString(),
        endsAt:zonedLocalToUtc(addLocalDays(`${holiday.date}T00:00`,1),input.venue.timezone!).toISOString(),
        providerId:'bank-holidays',evidence:'official' as const,timing:'scheduled' as const,relevance:exact?'overlap' as const:'context' as const,resolutionEligible:exact,
      }];
    });
    return { ...base, state: 'checked', data: conflicts };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: safeMessage(error) };
  }
}
