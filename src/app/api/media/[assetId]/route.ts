import { storeBucket } from "@/lib/server/firebase-admin";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

const mime: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await context.params;
    const match = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|jpeg|png|webp|avif)$/i.exec(assetId);
    if (!match) return new Response(null, { status: 404 });
    const file = storeBucket().file(`products/${assetId}`);
    const [exists] = await file.exists();
    if (!exists) return new Response(null, { status: 404 });
    const [buffer] = await file.download();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime[match[2].toLowerCase()],
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
