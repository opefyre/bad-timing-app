import { CheckResult } from '@/types';

export async function checkBankHolidays(dateTime: string, region: string = 'england-and-wales'): Promise<CheckResult> {
  try {
    const url = `https://www.gov.uk/bank-holidays.json`;
    const response = await fetch(url);
    const data = await response.json();

    const regionKey = region as keyof typeof data;
    if (!data[regionKey]) {
      return { success: true, data: [], source: 'GOV.UK Bank Holidays', lastChecked: new Date().toISOString() };
    }

    const targetDate = new Date(dateTime).toISOString().split('T')[0];
    const holidays = data[regionKey].events.filter((event: { date: string }) => event.date === targetDate);

    const conflicts = holidays.map((holiday: { title: string; date: string; notes: string }) => ({
      id: `bh-${holiday.date}`,
      type: 'holiday' as const,
      title: holiday.title,
      description: holiday.notes || `Bank holiday on ${new Date(holiday.date).toLocaleDateString()}`,
      impact: 'medium' as const,
      source: 'GOV.UK Bank Holidays',
      sourceUrl: 'https://www.gov.uk/bank-holidays',
      preference: 'neutral' as const,
      dateTime: holiday.date,
    }));

    return { success: true, data: conflicts, source: 'GOV.UK Bank Holidays', lastChecked: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', source: 'GOV.UK Bank Holidays', lastChecked: new Date().toISOString() };
  }
}
