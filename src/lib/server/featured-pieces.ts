import "server-only";

import type { ImageValue } from "../site-content";
import { findPreviewProduct } from "../preview-products";
import { getPublishedProduct } from "./products";
import { withTimeout } from "./timeout";

// Short in-process copy so a page view does not cost a Firestore read per piece.
const freshForMs = 30_000;
const covers = new Map<string, { at: number; image: ImageValue | null }>();

// Cover photograph for a featured piece. A live product wins; until the owner
// has real stock the supplied preview photograph of the same slug is used.
async function lookup(slug: string): Promise<ImageValue | null> {
  try {
    const live = await withTimeout(getPublishedProduct(slug), 1_500);
    const image = live?.images[0];
    if (image) return { url: image.url, alt: image.alt || live.name };
  } catch { /* Firestore unavailable: fall through to the preview photograph. */ }
  const preview = findPreviewProduct(slug)?.images[0];
  return preview ? { url: preview.url, alt: preview.alt } : null;
}

async function coverFor(slug: string): Promise<ImageValue | null> {
  const cached = covers.get(slug);
  if (cached && Date.now() - cached.at < freshForMs) return cached.image;
  const image = await lookup(slug);
  covers.set(slug, { at: Date.now(), image });
  return image;
}

/** Cover photographs for the chosen slugs, skipping any that cannot be shown. */
export async function featuredPieceImages(slugs: string[], fallbackSlugs: string[]): Promise<ImageValue[]> {
  const chosen = (await Promise.all(slugs.map(coverFor))).filter((image): image is ImageValue => image !== null);
  if (chosen.length > 0) return chosen;
  return (await Promise.all(fallbackSlugs.map(coverFor))).filter((image): image is ImageValue => image !== null);
}
