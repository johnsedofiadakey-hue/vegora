import { jsonError } from "@/lib/server/http";
import { hasAvailableProductsForAudience } from "@/lib/server/products";

export const runtime = "nodejs";

export async function GET() {
  try {
    const women = await hasAvailableProductsForAudience("women");
    // The same answer for everyone, so the browser and the CDN may keep it for a short while.
    return Response.json({ women }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=120" } });
  } catch (error) {
    return jsonError(error);
  }
}
