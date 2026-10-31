// Photo delivery. The hosting platform does not run Next.js's built-in image
// optimizer, so every photograph is requested through /api/image, which resizes
// it to a standard width and serves it as WebP. The rules for what may be
// requested live here, with no server imports, so the browser-side loader and
// the route share them and they can be tested directly.

/** The widths a photograph can be served at. The same list Next.js uses for srcset. */
export const imageWidths = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048] as const;

export const defaultQuality = 75;

const mediaSource = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp|avif)$/i;
// One level only, no leading dot: nothing here can climb out of the public folder.
const staticSource = /^\/(?:catalog|editorial)\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:png|jpe?g|webp|avif)$/i;

/** Only uploaded photographs and the site's own photographs can be resized. */
export function isOptimizableSource(src: string): boolean {
  return mediaSource.test(src) || staticSource.test(src);
}

export function isUploadedSource(src: string): boolean {
  return mediaSource.test(src);
}

/** The smallest allowed width that is at least as wide as asked for, never above the largest. */
export function snapWidth(requested: number): number {
  return imageWidths.find((width) => width >= requested) ?? imageWidths[imageWidths.length - 1];
}

export interface ImageRequest { src: string; width: number; quality: number }

export function parseImageRequest(params: URLSearchParams): ImageRequest | null {
  const src = params.get("src") ?? "";
  if (!isOptimizableSource(src)) return null;
  const rawWidth = params.get("w") ?? "";
  if (!/^[0-9]{1,5}$/.test(rawWidth)) return null;
  const requested = Number(rawWidth);
  if (requested < 1) return null;
  const rawQuality = params.get("q");
  if (rawQuality !== null && !/^[0-9]{1,3}$/.test(rawQuality)) return null;
  const quality = rawQuality === null ? defaultQuality : Math.min(90, Math.max(40, Number(rawQuality)));
  return { src, width: snapWidth(requested), quality };
}

/** What the browser asks for. Anything that cannot be resized is left as it is. */
export function imageUrl(src: string, width: number, quality?: number): string {
  if (!isOptimizableSource(src)) return src;
  return `/api/image?src=${encodeURIComponent(src)}&w=${width}&q=${quality ?? defaultQuality}`;
}
