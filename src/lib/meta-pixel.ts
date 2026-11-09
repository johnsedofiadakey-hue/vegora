// Meta (Facebook) Pixel events for the shop. The pixel script is loaded by
// <MetaPixel /> in the shop layout; events from before it starts are held and
// sent once it does. With no pixel ID configured these calls do nothing. Only
// product and order amounts are sent, never a customer's name, phone or address.

export const pixelId = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();
const pixelConfigured = /^[0-9]{10,20}$/.test(pixelId);

type Fbq = (command: "track" | "trackCustom", event: string, params?: Record<string, unknown>, options?: { eventID?: string }) => void;

export type PixelEvent = "ViewContent" | "AddToCart" | "AddToWishlist" | "InitiateCheckout" | "Purchase";

/**
 * Events that happen before the pixel script has run (a product page can load
 * its product first) wait in this window array; the script in <MetaPixel />
 * sends them as soon as it starts.
 */
export const pixelQueueName = "__vegoraPixelQueue";

export function trackPixel(event: PixelEvent, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined" || !pixelConfigured) return;
  const args = ["track", event, params, eventId ? { eventID: eventId } : undefined] as const;
  const scope = window as unknown as { fbq?: Fbq } & Record<string, unknown>;
  if (typeof scope.fbq === "function") {
    try { scope.fbq(...args); } catch { /* tracking must never break the shop */ }
    return;
  }
  const queue = (scope[pixelQueueName] ??= []) as unknown[];
  if (queue.length < 20) queue.push(args);
}

/** Amounts are stored in pesewas; Meta expects cedis. */
export function cedis(minor: number): number {
  return Math.round(minor) / 100;
}
