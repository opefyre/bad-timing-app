type Entry<T> = { value?: T; pending?: Promise<T>; expiresAt: number };

type GlobalCache = typeof globalThis & { __badTimingCache?: Map<string, Entry<unknown>> };
const root = globalThis as GlobalCache;
const store = root.__badTimingCache ?? new Map<string, Entry<unknown>>();
root.__badTimingCache = store;

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (store.size > 128) for (const [id, entry] of store) { if (!entry.pending) store.delete(id); if (store.size <= 96) break; }
  const existing = store.get(key) as Entry<T> | undefined;
  if (existing?.pending) return existing.pending;
  if (existing && existing.expiresAt > now && existing.value !== undefined) return existing.value;

  const pending = loader();
  store.set(key, { pending, expiresAt: now + ttlMs } as Entry<unknown>);
  try {
    const value = await pending;
    store.set(key, { value, expiresAt: Date.now() + ttlMs } as Entry<unknown>);
    return value;
  } catch (error) {
    store.delete(key);
    throw error;
  }
}
