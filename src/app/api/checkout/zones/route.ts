import { loadCheckoutConfig } from "@/lib/server/delivery-settings";
import { jsonError } from "@/lib/server/http";
import { getVoucherSettings } from "@/lib/server/vouchers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config = await loadCheckoutConfig();
    // "cod" on an area is true only when the shop-wide switch is on too, so the page needs one check.
    const zones = config.zones.map(({ id, label, region, cities, feeMinor, cod }) => ({
      id, label, region, cities: cities ?? null, feeMinor, cod: config.cod.enabled && cod === true,
    }));
    // Whether to show the voucher box. If the setting cannot be read, vouchers stay hidden.
    const vouchers = await getVoucherSettings().then((settings) => settings.enabled).catch(() => false);
    return Response.json({ zones, currency: "GHS", vouchers, cod: { enabled: config.cod.enabled, maxOrderMinor: config.cod.maxOrderMinor } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
