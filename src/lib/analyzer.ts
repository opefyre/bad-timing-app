import { EventInput, Conflict, Report, Suggestion } from '@/types';
import { checkTicketmaster } from './ticketmaster';
import { checkFootballData } from './football-data';
import { checkWeather } from './weather';
import { checkDaylight } from './daylight';
import { checkTVmaze } from './tvmaze';
import { checkBankHolidays } from './bank-holidays';
import { checkTfLDisruptions } from './tfl';

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted: string }> {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error('Geoapify API key not configured');
  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.append('text', address);
  url.searchParams.append('apiKey', apiKey);
  const response = await fetch(url.toString());
  const data = await response.json();
  if (!data.features?.length) throw new Error('Location not found');
  const feature = data.features[0];
  return { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0], formatted: feature.properties.formatted };
}

export async function analyzeEvent(input: EventInput): Promise<Report> {
  const conflicts: Conflict[] = [];
  const sources: { name: string; url: string; lastChecked: string }[] = [];
  const coverageGaps: string[] = [];

  let lat = input.venue.lat;
  let lng = input.venue.lng;

  if (!lat || !lng) {
    try {
      const coords = await geocodeAddress(input.venue.address);
      lat = coords.lat;
      lng = coords.lng;
    } catch {
      coverageGaps.push('Could not geocode venue address');
    }
  }

  if (lat && lng) {
    const ticketmasterResult = await checkTicketmaster(lat, lng, input.dateTime);
    if (ticketmasterResult.success && ticketmasterResult.data) conflicts.push(...ticketmasterResult.data);
    sources.push({ name: ticketmasterResult.source, url: 'https://www.ticketmaster.com', lastChecked: ticketmasterResult.lastChecked });

    const weatherResult = await checkWeather(lat, lng, input.dateTime);
    if (weatherResult.success && weatherResult.data) conflicts.push(...weatherResult.data);
    sources.push({ name: weatherResult.source, url: 'https://api.met.no/weatherapi/locationforecast/2.0', lastChecked: weatherResult.lastChecked });

    if (input.isOutdoor) {
      const daylightResult = await checkDaylight(lat, lng, input.dateTime, input.durationMinutes);
      if (daylightResult.success && daylightResult.data) conflicts.push(...daylightResult.data);
      sources.push({ name: daylightResult.source, url: 'https://sunrise-sunset.org', lastChecked: daylightResult.lastChecked });
    }

    const tflResult = await checkTfLDisruptions(lat, lng, input.dateTime);
    if (tflResult.success && tflResult.data) conflicts.push(...tflResult.data);
    sources.push({ name: tflResult.source, url: 'https://tfl.gov.uk', lastChecked: tflResult.lastChecked });
  }

  if (input.footballTeam) {
    const footballResult = await checkFootballData(input.footballTeam, input.dateTime);
    if (footballResult.success && footballResult.data) conflicts.push(...footballResult.data);
    sources.push({ name: footballResult.source, url: 'https://www.football-data.org', lastChecked: footballResult.lastChecked });
  }

  if (input.programmeName) {
    const tvResult = await checkTVmaze(input.programmeName, input.dateTime);
    if (tvResult.success && tvResult.data) conflicts.push(...tvResult.data);
    sources.push({ name: tvResult.source, url: 'https://www.tvmaze.com', lastChecked: tvResult.lastChecked });
  }

  const holidayResult = await checkBankHolidays(input.dateTime);
  if (holidayResult.success && holidayResult.data) conflicts.push(...holidayResult.data);
  sources.push({ name: holidayResult.source, url: 'https://www.gov.uk/bank-holidays', lastChecked: holidayResult.lastChecked });

  const suggestions = generateSuggestions(conflicts, input);
  return { conflicts, suggestions, checkedAt: new Date().toISOString(), sources, coverageGaps };
}

function generateSuggestions(conflicts: Conflict[], input: EventInput): Suggestion[] {
  const avoidConflicts = conflicts.filter((c) => c.preference === 'avoid');
  if (avoidConflicts.length === 0) return [];

  const eventDate = new Date(input.dateTime);
  const candidates: Suggestion[] = [];

  const tryEarlier = new Date(eventDate);
  tryEarlier.setHours(tryEarlier.getHours() - 2);
  candidates.push({
    change: `Start at ${tryEarlier.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} instead`,
    newDateTime: tryEarlier.toISOString(),
    conflictsResolved: avoidConflicts.filter((c) => !c.dateTime || new Date(c.dateTime) > tryEarlier).map((c) => c.id),
    conflictsRemaining: avoidConflicts.filter((c) => c.dateTime && new Date(c.dateTime) <= tryEarlier).map((c) => c.id),
    conflictsAdded: [],
  });

  const tryNextDay = new Date(eventDate);
  tryNextDay.setDate(tryNextDay.getDate() + 1);
  candidates.push({
    change: `Move to ${tryNextDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at the same time`,
    newDateTime: tryNextDay.toISOString(),
    conflictsResolved: avoidConflicts.filter((c) => c.type !== 'holiday').map((c) => c.id),
    conflictsRemaining: avoidConflicts.filter((c) => c.type === 'holiday').map((c) => c.id),
    conflictsAdded: [],
  });

  candidates.sort((a, b) => b.conflictsResolved.length - a.conflictsResolved.length || a.conflictsRemaining.length - b.conflictsRemaining.length);
  return candidates;
}
