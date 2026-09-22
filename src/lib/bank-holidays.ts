import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson } from './http';
import { defaultPreference } from './preferences';
import { addLocalDays, localDate } from './time';

type Holiday = { title: string; date: string; notes?: string };
type HolidayFeed = Record<string, { division: string; events: Holiday[] }>;

function regionFor(input: EventInput): string | null {
  if (input.venue.countryCode?.toLowerCase() !== 'gb') return null;
  const state = input.venue.state?.toLowerCase() ?? '';
  if (state.includes('scotland')) return 'scotland';
  if (state.includes('northern ireland')) return 'northern-ireland';
  return 'england-and-wales';
}

export async function checkBankHolidays(input: EventInput): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { source: 'GOV.UK Bank Holidays', sourceId: 'bank-holidays', url: 'https://www.gov.uk/bank-holidays', lastChecked: checkedAt };
  const region = regionFor(input);
  if (!region) return { ...base, state: 'not_applicable', data: [], message: 'UK-only data source' };

  try {
    const data = await cached('govuk-bank-holidays', 12 * 60 * 60_000, () => fetchJson<HolidayFeed>('https://www.gov.uk/bank-holidays.json'));
    const target = localDate(input.dateTime);
    const previous = localDate(addLocalDays(input.dateTime, -1));
    const next = localDate(addLocalDays(input.dateTime, 1));
    const events = data[region]?.events ?? [];
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
        startsAt: `${holiday.date}T00:00:00`,
      }];
    });
    return { ...base, state: 'checked', data: conflicts };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: error instanceof Error ? error.message : 'Request failed' };
  }
}
