import "server-only";

import { ServerConfigError } from "./firebase-admin";

export interface DeliveryZone {
  id: string;
  label: string;
  region: string;
  cities?: string[];
  feeMinor: number;
}

export type PaymentMode = "test" | "live";

export interface CheckoutConfig {
  secretKey: string;
  mode: PaymentMode;
  siteUrl: string;
  zones: DeliveryZone[];
}

// A live key is only accepted when VEGORA_PAYSTACK_MODE=live is also set, so
// real money cannot be switched on by pasting the wrong key alone.
export function paymentConfig(): { secretKey: string; mode: PaymentMode } {
  const secretKey = (process.env.PAYSTACK_SECRET_KEY ?? "").trim();
  const mode: PaymentMode = process.env.VEGORA_PAYSTACK_MODE === "live" ? "live" : "test";
  if (!secretKey.startsWith(`sk_${mode}_`) || secretKey.length < 20) {
    throw new ServerConfigError(`${mode === "live" ? "Live" : "Test"} payment verification is not configured`);
  }
  return { secretKey, mode };
}

export function checkoutConfig(): CheckoutConfig {
  const { secretKey, mode } = paymentConfig();
  const siteUrl = process.env.VEGORA_SITE_URL ?? "";
  const rawZones = process.env.VEGORA_DELIVERY_ZONES_JSON ?? "";
  if (process.env.VEGORA_CHECKOUT_ENABLED !== "true" ||
      process.env.VEGORA_WEBHOOK_CONFIRMED !== "true" ||
      process.env.VEGORA_EXPIRY_JOB_CONFIRMED !== "true" ||
      (process.env.VEGORA_CRON_SECRET ?? "").trim().length < 32 || !siteUrl || !rawZones) {
    throw new ServerConfigError("Checkout is not configured");
  }
  let url: URL;
  try { url = new URL(siteUrl); } catch { throw new ServerConfigError("Checkout site URL is invalid"); }
  if (url.protocol !== "https:" || url.pathname !== "/" || url.username || url.password || url.search || url.hash) {
    throw new ServerConfigError("Checkout site URL must be HTTPS");
  }
  let zones: unknown;
  try { zones = JSON.parse(rawZones); } catch { throw new ServerConfigError("Delivery zones are invalid"); }
  if (!Array.isArray(zones) || zones.length === 0 || zones.length > 100) {
    throw new ServerConfigError("Delivery zones are missing or invalid");
  }
  const parsed: DeliveryZone[] = zones.map((zone) => {
    if (!zone || typeof zone !== "object" || Array.isArray(zone)) throw new ServerConfigError("Delivery zones are invalid");
    const value = zone as Record<string, unknown>;
    if (typeof value.id !== "string" || !/^[a-z0-9-]{1,50}$/.test(value.id) ||
        typeof value.label !== "string" || !value.label.trim() || value.label.length > 100 ||
        typeof value.region !== "string" || !value.region.trim() || value.region.length > 100 ||
        !Number.isSafeInteger(value.feeMinor) || Number(value.feeMinor) < 0 || Number(value.feeMinor) > 10_000_000) {
      throw new ServerConfigError("Delivery zones are invalid");
    }
    if (value.cities !== undefined && (!Array.isArray(value.cities) || value.cities.length === 0 ||
        value.cities.some((city) => typeof city !== "string" || !city.trim() || city.length > 100))) {
      throw new ServerConfigError("Delivery cities are invalid");
    }
    return { id: value.id, label: value.label.trim(), region: value.region.trim(),
      cities: value.cities as string[] | undefined, feeMinor: Number(value.feeMinor) };
  });
  if (new Set(parsed.map((zone) => zone.id)).size !== parsed.length) {
    throw new ServerConfigError("Delivery zone IDs must be unique");
  }
  return { secretKey, mode, siteUrl: url.origin, zones: parsed };
}

export function matchingDeliveryZone(config: CheckoutConfig, id: string, region: string, city: string): DeliveryZone | null {
  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  return config.zones.find((zone) => zone.id === id && normalize(zone.region) === normalize(region) &&
    (!zone.cities || zone.cities.some((item) => normalize(item) === normalize(city)))) ?? null;
}
