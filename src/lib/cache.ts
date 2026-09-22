type Entry<T> = { value: T; expiresAt: number };

type GlobalCache = typeof globalThis & { __badTimingCache?: Map<string, Entry<unknown>> };
const root = globalThis as GlobalCache;
const store = root.__badTimingCache ?? new Map<string, Entry<unknown>>();
root.__badTimingCache = store;

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;
  if (existing && existing.expiresAt > now) return existing.value;
  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}
