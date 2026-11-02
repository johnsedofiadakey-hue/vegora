export const fulfillmentStatuses = ["unfulfilled", "preparing", "dispatched", "delivered"] as const;

export type FulfillmentStatus = (typeof fulfillmentStatuses)[number];

export type FulfillmentEventKind = "advance" | "rollback" | "update";

export interface Fulfillment {
  status: FulfillmentStatus;
  provider: string | null;
  trackingReference: string | null;
  updatedAt: string | null;
}

export interface FulfillmentEvent {
  status: FulfillmentStatus;
  provider: string | null;
  trackingReference: string | null;
  at: string;
  /** Older events were written before kinds existed; treat a missing kind as an advance. */
  kind?: FulfillmentEventKind;
  /** Internal operator note. Admin-only: never copied into the public tracking view. */
  note?: string | null;
}

export interface FulfillmentInput {
  status: FulfillmentStatus;
  provider: string;
  trackingReference: string;
  note: string;
}

export const emptyFulfillment: Fulfillment = {
  status: "unfulfilled", provider: null, trackingReference: null, updatedAt: null,
};

/** Validation failures from the pure parsers; API routes map these to HTTP 400. */
export class FulfillmentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FulfillmentInputError";
  }
}

const providerPattern = /^[\p{L}\p{N} .&'-]+$/u;
const trackingPattern = /^[A-Za-z0-9._/-]{3,100}$/;
const orderReferencePattern = /^VG-[0-9a-f]{32}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Keeps newlines and tabs, rejects every other control character.
const disallowedNoteCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const maxNoteLength = 500;

export function fulfillmentIndex(status: FulfillmentStatus): number {
  return fulfillmentStatuses.indexOf(status);
}

export function requiresTrackingReference(status: FulfillmentStatus): boolean {
  return status === "dispatched" || status === "delivered";
}

/**
 * Returns what a save would do, or null when it is not allowed.
 * Only verified-paid orders can change. Forward moves go one step at a time;
 * a mistaken step can be undone by moving back one step, except out of
 * "delivered", which is final.
 */
export function fulfillmentTransition(
  paymentStatus: string, current: FulfillmentStatus, next: FulfillmentStatus,
): FulfillmentEventKind | null {
  if (paymentStatus !== "paid") return null;
  const from = fulfillmentIndex(current);
  const to = fulfillmentIndex(next);
  if (from < 0 || to < 0) return null;
  if (to === from) return "update";
  if (to === from + 1) return "advance";
  if (to === from - 1 && current !== "delivered") return "rollback";
  return null;
}

export function canAdvanceFulfillment(paymentStatus: string, current: FulfillmentStatus, next: FulfillmentStatus): boolean {
  const kind = fulfillmentTransition(paymentStatus, current, next);
  return kind === "advance" || kind === "update";
}

export function allowedNextStatuses(current: FulfillmentStatus): FulfillmentStatus[] {
  return fulfillmentStatuses.filter((status) => fulfillmentTransition("paid", current, status) !== null);
}

function optionalText(value: unknown, name: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new FulfillmentInputError(`${name} is invalid`);
  const clean = value.trim();
  if (clean.length > max) throw new FulfillmentInputError(`${name} is too long`);
  return clean;
}

export function parseFulfillmentInput(value: unknown): FulfillmentInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FulfillmentInputError("Invalid delivery update");
  }
  const input = value as Record<string, unknown>;
  if (!fulfillmentStatuses.includes(input.status as FulfillmentStatus)) {
    throw new FulfillmentInputError("Choose a valid fulfillment status");
  }
  const status = input.status as FulfillmentStatus;
  const provider = optionalText(input.provider, "Delivery provider", 100);
  const trackingReference = optionalText(input.trackingReference, "Tracking reference", 100);
  const note = optionalText(input.note, "Note", maxNoteLength);
  if (provider && !providerPattern.test(provider)) {
    throw new FulfillmentInputError("Delivery provider has invalid characters");
  }
  if (trackingReference && !trackingPattern.test(trackingReference)) {
    throw new FulfillmentInputError("Tracking reference has invalid characters");
  }
  if (note && disallowedNoteCharacters.test(note)) {
    throw new FulfillmentInputError("Note has invalid characters");
  }
  if (requiresTrackingReference(status) && (!provider || !trackingReference)) {
    throw new FulfillmentInputError("Add a delivery provider and tracking reference before dispatch");
  }
  return { status, provider, trackingReference, note };
}

// A short, readable order number shown to customers, for example VG-7K2M9QXA.
// It is derived from the long payment reference (VG- plus 32 hex digits), which
// stays the real identifier everywhere else. Eight base-32 characters carry 40
// bits, and the alphabet leaves out I, L, O and U so it is hard to misread.
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const shortCodePattern = /^VG-[0-9A-HJKMNP-TV-Z]{8}$/;

export function shortOrderCode(reference: string): string | null {
  const match = /^VG-([0-9a-f]{32})$/i.exec(reference.trim());
  if (!match) return null;
  let value = parseInt(match[1].slice(0, 10), 16);
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code = alphabet[value % 32] + code;
    value = Math.floor(value / 32);
  }
  return `VG-${code}`;
}

/** Accepts what a person might type: any case, spaces or no dash, O for 0, I or L for 1. */
export function normalizeShortCode(input: string): string | null {
  let text = input.trim().toUpperCase().replace(/[\s-]+/g, "");
  if (text.startsWith("VG")) text = text.slice(2);
  text = text.replace(/O/g, "0").replace(/[IL]/g, "1");
  const code = `VG-${text}`;
  return shortCodePattern.test(code) ? code : null;
}

export type TrackingLookup = { reference: string | null; shortCode: string | null; email: string };

/** Accepts either the short order number (VG-7K2M9QXA) or the long payment reference. */
export function parseTrackingLookup(value: unknown): TrackingLookup {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FulfillmentInputError("Enter your order number and email");
  }
  const { reference, email } = value as Record<string, unknown>;
  if (typeof reference !== "string" || reference.length > 60 ||
      typeof email !== "string" || email.length > 254 || !emailPattern.test(email.trim())) {
    throw new FulfillmentInputError("Enter a valid order number and email");
  }
  const cleanEmail = email.trim().toLowerCase();
  if (orderReferencePattern.test(reference.trim())) {
    return { reference: `VG-${reference.trim().slice(3).toLowerCase()}`, shortCode: null, email: cleanEmail };
  }
  const shortCode = normalizeShortCode(reference);
  if (!shortCode) throw new FulfillmentInputError("Enter a valid order number and email");
  return { reference: null, shortCode, email: cleanEmail };
}

/** Same answer for a wrong reference and a wrong email, so lookups cannot probe for valid references. */
export function trackingLookupMatches(order: { email: string } | null, email: string): boolean {
  return !!order && order.email.trim().toLowerCase() === email;
}

/**
 * Replays the audit trail to the milestones the customer should see. Edits to
 * details (same status) are ignored, and a rollback removes the milestones it
 * retracted, so a corrected tracking reference or an undone step never shows
 * as a duplicate or phantom update.
 */
export function publicMilestones(events: Pick<FulfillmentEvent, "status" | "at">[]): { status: FulfillmentStatus; at: string }[] {
  const reached = new Map<FulfillmentStatus, string>();
  let previous = 0;
  for (const event of events) {
    const index = fulfillmentIndex(event.status);
    if (index < 0) continue;
    if (index > previous) {
      reached.set(event.status, event.at);
    } else if (index < previous) {
      for (const status of fulfillmentStatuses) {
        if (fulfillmentIndex(status) > index) reached.delete(status);
      }
    }
    previous = index;
  }
  return fulfillmentStatuses.flatMap((status) => {
    const at = reached.get(status);
    return status !== "unfulfilled" && at ? [{ status, at }] : [];
  });
}

export interface PublicTrackingItem { name: string; size: string; quantity: number; lineTotalMinor: number }

/** What the Track page may show: no name, phone, address, email, SKU, payment reference or operator notes. */
export function publicTrackingView(order: {
  reference: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  fulfillment?: Fulfillment;
  lines?: { name: string; size: string; quantity: number; lineTotalMinor: number }[];
  subtotalMinor?: number;
  deliveryFeeMinor?: number;
  totalMinor?: number;
  delivery?: { zoneLabel?: string };
}, events: Pick<FulfillmentEvent, "status" | "at">[]) {
  const fulfillment = order.fulfillment ?? emptyFulfillment;
  const paid = order.status === "paid";
  const showTracking = paid && requiresTrackingReference(fulfillment.status);
  const updates = paid ? publicMilestones(events) : [];
  const latest = [order.createdAt, order.paidAt, ...updates.map((update) => update.at)]
    .filter((value): value is string => typeof value === "string")
    .reduce((newest, value) => (Date.parse(value) > Date.parse(newest) ? value : newest), order.createdAt);
  const items: PublicTrackingItem[] = (order.lines ?? []).map((line) => ({
    name: line.name, size: line.size, quantity: line.quantity, lineTotalMinor: line.lineTotalMinor,
  }));
  return {
    orderId: shortOrderCode(order.reference) ?? order.reference,
    paymentStatus: order.status,
    placedAt: order.createdAt,
    paidAt: order.paidAt,
    fulfillmentStatus: paid ? fulfillment.status : "unfulfilled",
    provider: showTracking ? fulfillment.provider : null,
    trackingReference: showTracking ? fulfillment.trackingReference : null,
    updates,
    lastUpdateAt: latest,
    deliveryArea: order.delivery?.zoneLabel ?? null,
    items,
    subtotalMinor: order.subtotalMinor ?? null,
    deliveryFeeMinor: order.deliveryFeeMinor ?? null,
    totalMinor: order.totalMinor ?? null,
  };
}
