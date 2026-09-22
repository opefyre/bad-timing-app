import { safeMessage } from './http';
import { CheckResult, EventInput } from '@/types';
import { cached } from './cache';
import { fetchJson, HttpError } from './http';
import { eventWindow, formatInstant, localDate, overlaps, addLocalDays } from './time';
import { defaultPreference } from './preferences';

type Show = { id: number; name: string; url: string };
type Episode = { id: number; name: string; season: number; number: number; airstamp?: string; runtime?: number; url?: string };

async function resolveShow(input:EventInput):Promise<Show|null>{return input.programmeId&&input.programmeName?{id:input.programmeId,name:input.programmeName,url:`https://www.tvmaze.com/shows/${input.programmeId}`} : null;}

export async function checkTVmaze(input: EventInput): Promise<CheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { source: 'TVmaze', sourceId: 'tvmaze', url: 'https://www.tvmaze.com/api', lastChecked: checkedAt };
  if (!input.programmeName) return { ...base, state: 'not_applicable', data: [], message: 'No programme selected' };
  const timezone = input.venue.timezone;
  if (!timezone) return { ...base, state: 'unavailable', data: [], message: 'Venue timezone unavailable' };

  try {
    const show = await resolveShow(input);
    if (!show) return { ...base, state: 'partial', data: [], message: 'Choose the exact programme from search results' };
    const date = localDate(input.dateTime);
    const episodes:Episode[]=[];let partial=false;
    for(const delta of [-1,0,1]){const day=localDate(addLocalDays(`${date}T00:00`,delta));try{
      const rows=await cached(`tv-episodes:${show.id}:${day}`,3600000,()=>fetchJson<Episode[]>(`https://api.tvmaze.com/shows/${show.id}/episodesbydate?date=${day}`));
      if(!Array.isArray(rows))throw new Error('Unexpected programme response');episodes.push(...rows);
    }catch(error){if(!(error instanceof HttpError)||error.status!==404)throw error;}}
    const { start, end } = eventWindow(input.dateTime, input.durationMinutes, timezone);
    const conflicts = episodes.flatMap((episode) => {
      if (!episode.airstamp || !episode.runtime) {partial=true;return []; }
      const episodeStart = new Date(episode.airstamp);
      const episodeEnd = new Date(episodeStart.getTime() + episode.runtime * 60_000);
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
        providerId:'tvmaze',evidence:'structured' as const,timing:'scheduled' as const,relevance:'overlap' as const,resolutionEligible:true,
      }];
    });
    return { ...base, state: partial?'partial':'checked', data: conflicts };
  } catch (error) {
    return { ...base, state: 'unavailable', data: [], message: safeMessage(error) };
  }
}
