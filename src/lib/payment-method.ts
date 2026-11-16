// How a customer pays, and what pay on delivery needs from the order. Pure, so the same
// rules are tested and used by the server. The browser never decides whether pay on
// delivery is allowed: the server checks again when the order is made.

import { feeText, type CodSettings } from "./delivery.ts";

export type PaymentMethod = "paystack" | "cash_on_delivery";
export const paymentMethods: readonly PaymentMethod[] = ["paystack", "cash_on_delivery"];

/** An unconfirmed pay-on-delivery order holds its stock this long, then expires. */
export const codHoldHours = 48;
/** How many pay-on-delivery orders one phone number may have open (not yet delivered or cancelled). */
export const maxOpenCodPerPhone = 2;
/** Confirmed orders never expire on their own. Used in the same field as the 30-minute Paystack hold. */
export const codNeverExpires = "9999-12-31T23:59:59.000Z";

export function codHoldUntil(nowMs: number): string {
  return new Date(nowMs + codHoldHours * 3_600_000).toISOString();
}

export function parsePaymentMethod(value: unknown): PaymentMethod {
  if (value === undefined || value === null || value === "") return "paystack";
  if (value === "paystack" || value === "cash_on_delivery") return value;
  throw new RangeError("Choose how you want to pay");
}

/** Why pay on delivery cannot be used for this order, or null when it can. Worded for the customer. */
export function codProblem(settings: CodSettings, area: { cod: boolean }, totalMinor: number): string | null {
  if (!settings.enabled) return "Pay on delivery is not available. Please pay online.";
  if (!area.cod) return "Pay on delivery is not available in this area. Please pay online.";
  if (totalMinor > settings.maxOrderMinor) {
    return `Pay on delivery is for orders up to ${feeText(settings.maxOrderMinor)}. Please pay online for this order.`;
  }
  return null;
}

interface OrderLike { status: string; paymentMethod?: string; codConfirmedAt?: string | null }

export const isCodOrder = (order: OrderLike): boolean => order.paymentMethod === "cash_on_delivery";

/** A pay-on-delivery order that is waiting for the admin to ring the customer. */
export function needsPhoneConfirmation(order: OrderLike): boolean {
  return order.status === "pay_on_delivery" && !order.codConfirmedAt;
}

/** Delivery steps can start once the money is in (paid), or a pay-on-delivery order is confirmed. */
export function deliveryUnlocked(order: OrderLike): boolean {
  return order.status === "paid" || (order.status === "pay_on_delivery" && Boolean(order.codConfirmedAt));
}

/** An order that can still be cancelled by the admin: pay on delivery, not delivered, not already closed. */
export function canCancelCod(order: OrderLike & { fulfillment?: { status: string } }): boolean {
  return order.status === "pay_on_delivery" && (order.fulfillment?.status ?? "unfulfilled") !== "delivered";
}
