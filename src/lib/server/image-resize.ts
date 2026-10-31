import sharp from "sharp";

/**
 * Resizes a photograph to a standard width and returns WebP. The picture is
 * turned the way the camera meant it (phones store a rotation flag), and sharp
 * drops the rest of the metadata, so GPS location in a phone photo is not served.
 */
export async function resizeToWebp(input: Uint8Array, width: number, quality: number): Promise<Buffer> {
  return sharp(input, { failOn: "none", limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

export interface ImageCache {
  get(key: string): Buffer | undefined;
  set(key: string, value: Buffer): void;
  readonly size: number;
}

/** A small in-memory cache that forgets the least recently used photographs first. */
export function createImageCache(maxBytes: number, maxEntries: number): ImageCache {
  const entries = new Map<string, Buffer>();
  let bytes = 0;
  return {
    get(key) {
      const value = entries.get(key);
      if (value) { entries.delete(key); entries.set(key, value); }
      return value;
    },
    set(key, value) {
      if (value.length > maxBytes) return;
      const previous = entries.get(key);
      if (previous) { bytes -= previous.length; entries.delete(key); }
      entries.set(key, value);
      bytes += value.length;
      for (const [oldest, buffer] of entries) {
        if (bytes <= maxBytes && entries.size <= maxEntries) break;
        entries.delete(oldest);
        bytes -= buffer.length;
      }
    },
    get size() { return entries.size; },
  };
}
