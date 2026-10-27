import type { PaystackVerification } from "./paystack";

export type OrderStatus = "initializing" | "pending_payment" | "paid" | "failed" | "expired" | "review_required";
export type PaymentAction = "capture" | "release_review" | "release_failed" | "review" | "keep" | "reverse_review";

export function paymentAction(order: {
  reference: string; status: OrderStatus; totalMinor: number; currency: "GHS";
  email: string; reservationExpiresAt: string;
}, verification: PaystackVerification, now: string): PaymentAction {
  if (order.status === "paid") return verification.status === "reversed" ? "reverse_review" : "keep";
  if (order.status === "review_required") return "keep";
  const active = order.status === "initializing" || order.status === "pending_payment";
  if (verification.status === "success") {
    const exact = verification.reference === order.reference &&
      verification.amount === order.totalMinor && verification.currency === order.currency &&
      verification.domain === "test" && verification.customerEmail?.toLowerCase() === order.email;
    if (exact && active && now < order.reservationExpiresAt) return "capture";
    return active ? "release_review" : "review";
  }
  if (["failed", "abandoned", "reversed"].includes(verification.status) && active) return "release_failed";
  return "keep";
}
