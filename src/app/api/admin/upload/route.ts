import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/server/admin-auth";
import { storeBucket } from "@/lib/server/firebase-admin";
import { HttpError, jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

const maxBytes = 8 * 1024 * 1024;

function imageExtension(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  if (String.fromCharCode(...bytes.slice(4, 12)).includes("ftypavif")) return "avif";
  return null;
}

const mime: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes + 100_000) throw new HttpError(413, "Image must be under 8 MB");
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Choose an image");
    if (file.size === 0 || file.size > maxBytes) throw new HttpError(413, "Image must be under 8 MB");
    const buffer = new Uint8Array(await file.arrayBuffer());
    const extension = imageExtension(buffer);
    if (!extension) throw new HttpError(400, "Use JPEG, PNG, WebP or AVIF");
    const assetId = `${randomUUID()}.${extension}`;
    await storeBucket().file(`products/${assetId}`).save(Buffer.from(buffer), {
      resumable: false,
      contentType: mime[extension],
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    });
    return Response.json({ url: `/api/media/${assetId}` }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
