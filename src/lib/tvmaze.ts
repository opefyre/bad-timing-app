import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson, HttpError } from './http';
import { eventWindow, formatInstant, localDate, overlaps } from './time';
import { defaultPreference } from './preferences';

type Show = { id: number; name: string; url: string };
type SearchHit = { score: number; show: Show };
type Episode = { id: number; name: string; season: number; number: number; airstamp?: string; runtime?: number; url?: string };

async function resolveShow(input: EventInput): Promise<Show | null> {
  if (input.programmeId && input.programmeName) return { id: input.programmeId, name: input.programmeName, url: `https://www.tvmaze.com/shows/${input.programmeId}` };
  if (!input.programmeName) return null;
  const hits = await cached(`tv-search:${input.programmeName.toLowerCase()}`, 60 * 60_000, () => fetchJson<SearchHit[]>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(input.programmeName!)}`));
  if (!hits.length) return null;
  const exact = hits.find((hit) => hit.show.name.toLowerCase() === input.programmeName!.toLowerCase());
  return (exact ?? hits[0]).show;
}

export async function checkTVmaze(input: EventInput): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { source: 'TVmaze', sourceId: 'tvmaze', url: 'https://www.tvmaze.com/api', lastChecked: checkedAt };
  if (!input.programmeName) return { ...base, state: 'not_applicable', data: [], message: 'No programme selected' };
  const timezone = input.venue.timezone;
  if (!timezone) return { ...base, state: 'unavailable', data: [], message: 'Venue timezone unavailable' };

  try {
    const show = await resolveShow(input);
    if (!show) return { ...base, state: 'checked', data: [], message: 'Programme not found' };
    const date = localDate(input.dateTime);
    let episodes: Episode[] = [];
    try {
      episodes = await cached(`tv-episodes:${show.id}:${date}`, 60 * 60_000, () => fetchJson<Episode[]>(`https://api.tvmaze.com/shows/${show.id}/episodesbydate?date=${date}`));
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) throw error;
    }
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const conflicts = episodes.flatMap((episode) => {
      if (!episode.airstamp) return [];
      const episodeStart = new Date(episode.airstamp);
      const episodeEnd = new Date(episodeStart.getTime() + (episode.runtime ?? 60) * 60_000);
      if (!overlaps(start, end, episodeStart, episodeEnd)) return [];
      return [{
        id: `tv-${episode.id}`,
        type: 'tv' as const,
        title: `${show.name} · S${episode.season}E${episode.number}`,
        description: `${episode.name} · ${formatInstant(episode.airstamp, timezone)}`,
        impact: 'medium' as const,
        source: base.source,
        sourceUrl: episode.url ?? show.url,
        preference: defaultPreference('tv', input),
        startsAt: episode.airstamp,
        endsAt: episodeEnd.toISOString(),
      }];
    });
    return { ...base, state: 'checked', data: conflicts };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: error instanceof Error ? error.message : 'Request failed' };
  }
}
