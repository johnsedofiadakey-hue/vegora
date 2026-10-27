import { checkoutConfig } from "@/lib/server/checkout-config";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const zones = checkoutConfig().zones.map(({ id, label, region, cities, feeMinor }) => ({
      id, label, region, cities: cities ?? null, feeMinor,
    }));
    return Response.json({ zones, currency: "GHS" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
