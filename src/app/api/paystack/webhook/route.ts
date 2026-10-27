import { paymentConfig } from "@/lib/server/checkout-config";
import { HttpError, jsonError } from "@/lib/server/http";
import { getOrder, reconcilePayment } from "@/lib/server/orders";
import { PaystackError, validPaystackSignature, verifyPaystack } from "@/lib/server/paystack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = paymentConfig();
    if (Number(request.headers.get("content-length") ?? 0) > 1024 * 1024) throw new HttpError(413, "Webhook payload too large");
    const raw = Buffer.from(await request.arrayBuffer());
    if (raw.length > 1024 * 1024) throw new HttpError(413, "Webhook payload too large");
    if (!validPaystackSignature(raw, request.headers.get("x-paystack-signature"), config.secretKey)) {
      throw new HttpError(401, "Invalid webhook signature");
    }
    let event: unknown;
    try { event = JSON.parse(raw.toString("utf8")); } catch { throw new HttpError(400, "Invalid webhook JSON"); }
    if (!event || typeof event !== "object" || !("event" in event) || event.event !== "charge.success") {
      return Response.json({ received: true });
    }
    const data = "data" in event && event.data && typeof event.data === "object" ? event.data as Record<string, unknown> : null;
    const reference = typeof data?.reference === "string" ? data.reference : "";
    if (!/^VG-[0-9a-f]{32}$/.test(reference)) return Response.json({ received: true });
    const order = await getOrder(reference);
    if (!order) throw new HttpError(503, "Order is not ready for reconciliation");
    const verification = await verifyPaystack(reference, config.secretKey);
    if (verification.reference !== reference) throw new PaystackError("Payment reference mismatch");
    if (verification.status !== "success") throw new HttpError(503, "Payment verification is pending");
    await reconcilePayment(verification);
    return Response.json({ received: true });
  } catch (error) {
    return jsonError(error);
  }
}
