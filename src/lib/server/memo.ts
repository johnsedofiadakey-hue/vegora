import "server-only";

// A short-lived copy of an answer kept in memory, so that many visitors asking the same question in the
// same minute cost one database read instead of one each. Each running copy of the site keeps its own.
// Answers that fail are never kept. Saving a product (or an order that reserves stock) clears everything
// on that copy straight away; other copies catch up when theirs expire. The same module may be loaded by
// pages and by route handlers as separate copies, so the store lives on globalThis.

interface Entry { at: number; value: unknown }
interface Store { entries: Map<string, Entry>; loading: Map<string, Promise<unknown>>; generation: number }

const shared = globalThis as typeof globalThis & { __vegoraMemo?: Store };
const store: Store = shared.__vegoraMemo ??= { entries: new Map(), loading: new Map(), generation: 0 };
const maxEntries = 200;

export async function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const pending = store.loading.get(key);
  if (pending) return pending as Promise<T>;
  const generation = store.generation;
  const request = load().then((value) => {
    // An answer that began before the cache was cleared may be out of date: use it once, do not keep it.
    if (generation === store.generation) {
      store.entries.set(key, { at: Date.now(), value });
      while (store.entries.size > maxEntries) {
        const oldest = store.entries.keys().next().value;
        if (oldest === undefined) break;
        store.entries.delete(oldest);
      }
    }
    return value;
  }).finally(() => { if (store.loading.get(key) === request) store.loading.delete(key); });
  store.loading.set(key, request);
  return request;
}

export function forgetMemo(): void {
  store.generation += 1;
  store.entries.clear();
  store.loading.clear();
}
