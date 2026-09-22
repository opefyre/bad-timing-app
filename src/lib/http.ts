import { createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) { super(message); }
}
export function safeMessage(error: unknown): string {
  if (error instanceof HttpError) {
    if ([401, 403].includes(error.status)) return 'Connection needs attention';
    if (error.status === 429) return 'Provider limit reached. Try again later.';
    if (error.status === 404) return 'Feed not found';
    return 'Provider unavailable';
  }
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError') ? 'Provider timed out' : 'Could not check this source';
}
type Entry = { body: Uint8Array; type: string; expires: number; fetchedAt: string; etag?: string; modified?: string };
const memory = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
const cooldown = new Map<string, number>();
const failures = new Map<string,{until:number;status:number}>();
const MAX_ENTRIES = 100; const MAX_BYTES = 5 * 1024 * 1024;
let storedBytes = 0;
function evict() {
  for (const [key, e] of memory) {
    if (memory.size <= MAX_ENTRIES && storedBytes <= 24 * 1024 * 1024) break;
    memory.delete(key); storedBytes -= e.body.byteLength;
  }
}
/** Only code-owned, fixed provider URLs enter here. Registry feeds use the SSRF guard first. */
async function request(url: string, init: RequestInit = {}, timeoutMs = 8000, ttlMs = 0): Promise<Entry> {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('HTTPS is required');
  const headers = new Headers(init.headers);
  const key = createHash('sha256').update(url + JSON.stringify([...headers]) + String(init.body ?? '')).digest('hex');
  const failed=failures.get(key);if(failed&&failed.until>Date.now())throw new HttpError(failed.status,'Provider unavailable');
  if(failures.size>300)for(const[k,v]of failures)if(v.until<Date.now())failures.delete(k);
  const cached = memory.get(key);
  if (cached && cached.expires > Date.now()) return cached;
  if (inflight.has(key)) return inflight.get(key)!;
  if ((cooldown.get(u.hostname) ?? 0) > Date.now()) throw new HttpError(429, 'Rate limited');
  const run = (async () => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (cached?.etag) headers.set('If-None-Match', cached.etag);
      if (cached?.modified) headers.set('If-Modified-Since', cached.modified);
      // Following redirects with credentials is forbidden. Configure the final HTTPS feed URL.
      const response = await fetch(url, { ...init, headers, signal: controller.signal, redirect: 'error', cache: 'no-store' });
      if (response.status === 304 && cached) { cached.expires = Date.now() + ttlMs; return cached; }
      if (!response.ok) {
        if (response.status === 429) {
          const value = response.headers.get('retry-after') ?? '60';
          const delay = Number.isFinite(Number(value)) ? Number(value) * 1000 : Date.parse(value) - Date.now();
          cooldown.set(u.hostname, Date.now() + Math.min(300000, Math.max(1000, delay || 60000)));
        }
        if([400,401,403,404].includes(response.status)||response.status>=500)failures.set(key,{until:Date.now()+60000,status:response.status});
        await response.body?.cancel();
        throw new HttpError(response.status, `HTTP ${response.status}`);
      }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) { await response.body?.cancel(); throw new Error('Feed too large'); }
      const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
      if (reader) while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error('Feed too large'); }
        chunks.push(part.value);
      }
      const body = new Uint8Array(bytes); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      const cc = response.headers.get('cache-control') ?? '';
      const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(cc);
      const expiresHeader = Date.parse(response.headers.get('expires') ?? '');
      const serverTtl = maxAge ? Number(maxAge[1]) * 1000 : Number.isFinite(expiresHeader) ? Math.max(0, expiresHeader - Date.now()) : 0;
      const effectiveTtl = /no-store|private|no-cache/i.test(cc) ? 0 : maxAge||Number.isFinite(expiresHeader) ? serverTtl : ttlMs;
      const entry: Entry = { body, type: response.headers.get('content-type') ?? '', fetchedAt: new Date().toISOString(), expires: Date.now() + effectiveTtl, etag: response.headers.get('etag') ?? undefined, modified: response.headers.get('last-modified') ?? undefined };
      if (effectiveTtl > 0) { if (cached) storedBytes -= cached.body.byteLength; memory.set(key, entry); storedBytes += bytes; evict(); }
      return entry;
    } catch(error) { if(!(error instanceof HttpError)){failures.set(key,{until:Date.now()+30000,status:503});}throw error; } finally { clearTimeout(timer); }
  })();
  inflight.set(key, run);
  try { return await run; } finally { inflight.delete(key); }
}
export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  return JSON.parse(new TextDecoder().decode((await request(url, init, timeoutMs)).body)) as T;
}
export async function getJson(url: string, ttlMs = 300000, headers: Record<string, string> = {}, init: RequestInit = {}): Promise<{ data: unknown; fetchedAt: string }> {
  const e = await request(url, { ...init, headers: { Accept: 'application/json', ...Object.fromEntries(new Headers(init.headers)), ...headers } }, 8000, ttlMs);
  return { data: JSON.parse(new TextDecoder().decode(e.body)), fetchedAt: e.fetchedAt };
}
export async function getText(url: string, ttlMs = 300000, headers: Record<string, string> = {}): Promise<{ data: string; fetchedAt: string }> {
  const e = await request(url, { headers }, 8000, ttlMs); return { data: new TextDecoder().decode(e.body), fetchedAt: e.fetchedAt };
}
export async function getBytes(url: string, ttlMs = 60000, headers: Record<string, string> = {}): Promise<{ data: Uint8Array; fetchedAt: string }> {
  const e = await request(url, { headers }, 8000, ttlMs); return { data: e.body, fetchedAt: e.fetchedAt };
}
export function clearHttpCache() { memory.clear(); inflight.clear(); cooldown.clear(); failures.clear(); storedBytes = 0; }
