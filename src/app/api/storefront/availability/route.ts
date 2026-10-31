import { jsonError } from "@/lib/server/http";
import { hasAvailableProductsForAudience } from "@/lib/server/products";

export const runtime = "nodejs";

export async function GET() {
  try {
    const women = await hasAvailableProductsForAudience("women");
    return Response.json({ women }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
