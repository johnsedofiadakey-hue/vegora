import { paymentConfig } from "@/lib/server/checkout-config";
import { HttpError, jsonError } from "@/lib/server/http";
import { getOrder, reconcilePayment } from "@/lib/server/orders";
import { PaystackError, verifyPaystack } from "@/lib/server/paystack";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const config = paymentConfig();
    const reference = new URL(request.url).searchParams.get("reference") ?? "";
    if (!/^VG-[0-9a-f]{32}$/.test(reference)) throw new HttpError(400, "Invalid payment reference");
    const order = await getOrder(reference);
    if (!order) throw new HttpError(404, "Order not found");
    const verification = await verifyPaystack(reference, config.secretKey);
    if (verification.reference !== reference) throw new PaystackError("Payment reference mismatch");
    const reconciled = await reconcilePayment(verification);
    if (!reconciled) throw new HttpError(404, "Order not found");
    return Response.json({ status: reconciled.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
