import { readFile } from "node:fs/promises";
import path from "node:path";
import { isUploadedSource, parseImageRequest } from "@/lib/image-delivery";
import { storeBucket } from "@/lib/server/firebase-admin";
import { createImageCache, resizeToWebp } from "@/lib/server/image-resize";

export const runtime = "nodejs";

const types: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };
const forever = "public, max-age=31536000, immutable";
const recent = createImageCache(24 * 1024 * 1024, 120);

// The built-in Next.js image optimizer is not available on this host, so this
// route resizes photographs. It only accepts uploaded photographs and the
// site's own /catalog and /editorial files (see image-delivery.ts), at a fixed
// list of widths. If anything goes wrong the original is served, so a photograph
// is never lost because it could not be resized.
export async function GET(request: Request) {
  const image = parseImageRequest(new URL(request.url).searchParams);
  if (!image) return new Response("Unsupported image request", { status: 400 });

  const key = `${image.src}|${image.width}|${image.quality}`;
  const hit = recent.get(key);
  if (hit) return photo(hit, "image/webp", forever);

  const extension = image.src.slice(image.src.lastIndexOf(".") + 1).toLowerCase();
  let original: Buffer;
  try {
    if (isUploadedSource(image.src)) {
      const file = storeBucket().file(`products/${image.src.slice("/api/media/".length)}`);
      const [exists] = await file.exists();
      if (!exists) return new Response(null, { status: 404 });
      [original] = await file.download();
    } else {
      original = await readFile(path.join(process.cwd(), "public", image.src));
    }
  } catch {
    // The site's own photographs can still be sent straight from the public folder.
    return isUploadedSource(image.src)
      ? new Response(null, { status: 502 })
      : new Response(null, { status: 302, headers: { Location: image.src, "Cache-Control": "public, max-age=60" } });
  }

  try {
    const resized = await resizeToWebp(original, image.width, image.quality);
    recent.set(key, resized);
    return photo(resized, "image/webp", forever);
  } catch (error) {
    console.error("VEGORA image could not be resized; sending the original", image.src, error);
    return photo(original, types[extension] ?? "application/octet-stream", "public, max-age=300");
  }
}

function photo(body: Buffer, contentType: string, cacheControl: string): Response {
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": contentType, "Content-Length": String(body.length), "Cache-Control": cacheControl, "X-Content-Type-Options": "nosniff" },
  });
}
