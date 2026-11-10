// Google Analytics 4 for the shop. The gtag script is loaded by
// <GoogleAnalytics /> in the shop layout; events from before it starts are held
// and sent once it does. With no measurement ID configured these calls do
// nothing. Only product and order amounts are sent, never a customer's name,
// phone, email or address.

export const gaMeasurementId = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim();
export const gaConfigured = /^G-[A-Z0-9]{4,16}$/.test(gaMeasurementId);

/** Events raised before the gtag snippet has run wait here; the snippet sends them. */
export const gaQueueName = "__vegoraGaQueue";

type Gtag = (command: "event", event: string, params?: Record<string, unknown>) => void;

/** The shop's own event names (shared with the Meta Pixel) and their GA4 names. */
const gaNames = {
  ViewContent: "view_item",
  AddToCart: "add_to_cart",
  AddToWishlist: "add_to_wishlist",
  InitiateCheckout: "begin_checkout",
  Purchase: "purchase",
} as const;

export type ShopEvent = keyof typeof gaNames;

/**
 * Turns the Meta-style parameters the shop already raises (content_ids,
 * content_name, value, currency, num_items) into GA4 ecommerce parameters.
 */
export function gaEvent(event: ShopEvent, params: Record<string, unknown> = {}, eventId?: string): [string, Record<string, unknown>] {
  const ids = Array.isArray(params.content_ids) ? params.content_ids.filter((id): id is string => typeof id === "string") : [];
  const name = typeof params.content_name === "string" ? params.content_name : undefined;
  const items = ids.map((id) => ({ item_id: id, ...(name && ids.length === 1 ? { item_name: name } : {}) }));
  const out: Record<string, unknown> = { items };
  if (typeof params.value === "number") out.value = params.value;
  if (typeof params.currency === "string") out.currency = params.currency;
  if (event === "Purchase" && eventId) out.transaction_id = eventId;
  return [gaNames[event], out];
}

export function trackGoogle(event: ShopEvent, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined" || !gaConfigured) return;
  const [name, gaParams] = gaEvent(event, params, eventId);
  const args = ["event", name, gaParams] as const;
  const scope = window as unknown as { gtag?: Gtag } & Record<string, unknown>;
  if (typeof scope.gtag === "function") {
    try { scope.gtag(...args); } catch { /* tracking must never break the shop */ }
    return;
  }
  const queue = (scope[gaQueueName] ??= []) as unknown[];
  if (queue.length < 20) queue.push(args);
}
