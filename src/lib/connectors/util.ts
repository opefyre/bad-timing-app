import { CheckResult, Conflict, EventInput, SourceState } from '@/types';
import { eventWindow, overlaps } from '../time';
import { haversineKm } from '../geo';
import { safeMessage } from '../http';

export type Row = Record<string, unknown>;
export const obj = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
export const arr = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const str = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
export function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '' || typeof value === 'boolean') return undefined;
  const n = Number(value); return Number.isFinite(n) ? n : undefined;
}
export function text(value: unknown, max = 700): string {
  return str(value).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim().slice(0, max);
}
export function safeUrl(value: unknown): string | undefined {
  try { const u = new URL(str(value)); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.toString() : undefined; } catch { return undefined; }
}
export function iso(value: unknown, assumeUtc = false): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  let v = typeof value === 'number' ? value : str(value);
  if (typeof v === 'string' && !/(Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(v)) {
    if (!assumeUtc) return undefined;
    v += 'Z';
  }
  const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}
export function hash(value: string): string {
  let h = 2166136261; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
export function radius(input: EventInput): number { return Math.max(0.5, Math.min(20, input.radiusKm ?? 3)); }
export function bounds(input: EventInput, km = radius(input)): [number, number, number, number] {
  const lat = input.venue.lat!; const lon = input.venue.lng!;
  const dy = km / 111.32; const dx = km / (111.32 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
  // Split antimeridian boxes at the adapter if needed; never submit invalid bounds.
  return [Math.max(-180, lon - dx), Math.max(-90, lat - dy), Math.min(180, lon + dx), Math.min(90, lat + dy)];
}
export function windowFor(input: EventInput) { return eventWindow(input.dateTime, input.durationMinutes, input.venue.timezone!); }
export function during(input: EventInput, start?: string, end?: string): boolean {
  if (!start || !end) return false;
  const w = windowFor(input); return overlaps(w.start, w.end, new Date(start), new Date(end));
}
export function currentEvent(input: EventInput, now = Date.now(), hours = 24): boolean {
  const w = windowFor(input); return w.end.getTime() >= now && w.start.getTime() <= now + hours * 3600000;
}
export function distance(input: EventInput, lat: unknown, lon: unknown): number | undefined {
  const y = num(lat); const x = num(lon);
  if (y === undefined || x === undefined || Math.abs(y) > 90 || Math.abs(x) > 180) return undefined;
  return haversineKm(input.venue.lat!, input.venue.lng!, y, x);
}
export function outcome(id: string, name: string, url: string, state: SourceState, data: Conflict[] = [], message?: string, extra: Partial<CheckResult> = {}): CheckResult {
  return { sourceId: id, source: name, url, state, data, lastChecked: new Date().toISOString(), message, scope: 'event', itemCount: data.length, ...extra };
}
export function failure(id: string, name: string, url: string, error: unknown): CheckResult {
  return outcome(id, name, url, 'unavailable', [], safeMessage(error));
}
export function missing(id: string, name: string, url: string): CheckResult {
  return outcome(id, name, url, 'not_configured', [], 'Not connected');
}
export function finding(id: string, provider: string, name: string, url: string, extra: Partial<Conflict>): Conflict {
  return { id: `${provider}:${id}`, providerId: provider, type: 'civic', title: name, description: '', impact: 'low', source: name, sourceUrl: url, preference: 'neutral', evidence: 'structured', timing: 'unknown', relevance: 'context', resolutionEligible: false, retrievedAt: new Date().toISOString(), ...extra };
}
export async function mapLimit<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(items.length, concurrency) }, async () => {
    while (cursor < items.length) { const i = cursor++; results[i] = await fn(items[i], i); }
  }));
  return results;
}
