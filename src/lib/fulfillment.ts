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

export function parseTrackingLookup(value: unknown): { reference: string; email: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FulfillmentInputError("Enter your order reference and email");
  }
  const { reference, email } = value as Record<string, unknown>;
  if (typeof reference !== "string" || !orderReferencePattern.test(reference.trim()) ||
      typeof email !== "string" || email.length > 254 || !emailPattern.test(email.trim())) {
    throw new FulfillmentInputError("Enter a valid order reference and email");
  }
  return { reference: `VG-${reference.trim().slice(3).toLowerCase()}`, email: email.trim().toLowerCase() };
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

export function publicTrackingView(order: {
  reference: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  fulfillment?: Fulfillment;
}, events: Pick<FulfillmentEvent, "status" | "at">[]) {
  const fulfillment = order.fulfillment ?? emptyFulfillment;
  const paid = order.status === "paid";
  const showTracking = paid && requiresTrackingReference(fulfillment.status);
  return {
    orderId: order.reference,
    paymentStatus: order.status,
    placedAt: order.createdAt,
    paidAt: order.paidAt,
    fulfillmentStatus: paid ? fulfillment.status : "unfulfilled",
    provider: showTracking ? fulfillment.provider : null,
    trackingReference: showTracking ? fulfillment.trackingReference : null,
    updates: paid ? publicMilestones(events) : [],
  };
}
