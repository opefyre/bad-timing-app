import { CheckResult } from '@/types';

export async function checkTVmaze(programmeName: string, dateTime: string): Promise<CheckResult> {
  try {
    const searchUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(programmeName)}`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.length) {
      return { success: true, data: [], source: 'TVmaze', lastChecked: new Date().toISOString() };
    }

    const show = searchData[0].show;
    const scheduleUrl = `https://api.tvmaze.com/shows/${show.id}/episodes`;
    const scheduleResponse = await fetch(scheduleUrl);
    const scheduleData = await scheduleResponse.json();

    const targetDate = new Date(dateTime).toISOString().split('T')[0];
    const episodes = scheduleData.filter((episode: { airdate: string }) => episode.airdate === targetDate);

    const conflicts = episodes.map((episode: { id: number; name: string; airdate: string; airstamp: string; season: number; number: number }) => ({
      id: `tv-${episode.id}`,
      type: 'tv' as const,
      title: `${show.name} - S${episode.season}E${episode.number}: ${episode.name}`,
      description: `Airs at ${new Date(episode.airstamp).toLocaleTimeString()}`,
      impact: 'medium' as const,
      source: 'TVmaze',
      sourceUrl: show.url,
      preference: 'neutral' as const,
      dateTime: episode.airstamp,
    }));

    return { success: true, data: conflicts, source: 'TVmaze', lastChecked: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', source: 'TVmaze', lastChecked: new Date().toISOString() };
  }
}
