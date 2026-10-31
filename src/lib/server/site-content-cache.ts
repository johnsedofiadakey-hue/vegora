import "server-only";

import { defaultValues, type BlockId, type ContentValues, type TypedValues } from "../site-content";
import { ServerConfigError } from "./firebase-admin";
import { getPublishedBlock } from "./site-content";
import { withTimeout } from "./timeout";

// The storefront renders per request, so a visitor never sees text frozen at
// build time. To avoid a Firestore read on every page view, each instance keeps
// a short-lived copy of each block. Publishing clears this instance's copy at
// once; other instances pick the change up when their copy expires.
const freshForMs = 30_000;
// A page must never wait long on Firestore: past this it shows the last good text.
const readTimeoutMs = 3_000;

interface Entry { at: number; values: ContentValues; failed?: boolean }
interface ContentCache { entries: Map<BlockId, Entry>; loading: Map<BlockId, Promise<ContentValues>>; generation: Map<BlockId, number> }

// Next builds route handlers and pages as separate module graphs, so a plain
// module-level Map would be two different caches and publishing from the route
// would never clear the copy the pages use. globalThis is shared by both.
const shared = globalThis as typeof globalThis & { __vegoraContentCache?: ContentCache };
const { entries, loading, generation } = shared.__vegoraContentCache ??= { entries: new Map(), loading: new Map(), generation: new Map() };

export function forgetContent(id?: BlockId): void {
  // Bumping the generation makes any read already in flight discard its result,
  // so a read that began before a publish cannot put the old text back.
  for (const key of id ? [id] : [...generation.keys(), ...entries.keys(), ...loading.keys()]) {
    generation.set(key, (generation.get(key) ?? 0) + 1);
    entries.delete(key); loading.delete(key);
  }
}

async function load(id: BlockId): Promise<ContentValues> {
  const entry = entries.get(id);
  if (entry && Date.now() - entry.at < freshForMs) return entry.values;
  const pending = loading.get(id);
  if (pending) return pending;
  const startedIn = generation.get(id) ?? 0;
  const current = () => (generation.get(id) ?? 0) === startedIn;
  const request = withTimeout(getPublishedBlock(id), readTimeoutMs)
    .then((values) => { if (current()) entries.set(id, { at: Date.now(), values }); return values; })
    .catch((error: unknown) => {
      // Never let a content problem take a page down. Keep showing the last
      // good copy, or the built-in text if there never was one.
      if (!(error instanceof ServerConfigError) && !entry?.failed) console.error(`VEGORA content "${id}" could not be read; showing the last good copy`, error);
      const values = entry?.values ?? defaultValues(id);
      // Retry soon rather than hammering a failing service on every request.
      if (current()) entries.set(id, { at: Date.now() - freshForMs + 5_000, values, failed: true });
      return values;
    })
    .finally(() => { if (current()) loading.delete(id); });
  loading.set(id, request);
  return request;
}

/** The live text for a block. Falls back to the built-in wording on any failure. */
export async function getContent<K extends BlockId>(id: K): Promise<TypedValues<K>> {
  return await load(id) as unknown as TypedValues<K>;
}
