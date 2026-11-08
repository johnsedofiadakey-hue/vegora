import { checkoutConfig } from "@/lib/server/checkout-config";
import { jsonError } from "@/lib/server/http";
import { getVoucherSettings } from "@/lib/server/vouchers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const zones = checkoutConfig().zones.map(({ id, label, region, cities, feeMinor }) => ({
      id, label, region, cities: cities ?? null, feeMinor,
    }));
    // Whether to show the voucher box. If the setting cannot be read, vouchers stay hidden.
    const vouchers = await getVoucherSettings().then((settings) => settings.enabled).catch(() => false);
    return Response.json({ zones, currency: "GHS", vouchers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
