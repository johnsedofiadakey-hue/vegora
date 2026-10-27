import { checkoutConfig } from "@/lib/server/checkout-config";
import { jsonError, readJson, HttpError } from "@/lib/server/http";
import { failInitialization, parseCheckoutInput, reserveOrder, markOrderInitialized } from "@/lib/server/orders";
import { initializePaystack } from "@/lib/server/paystack";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = checkoutConfig();
    const input = parseCheckoutInput(await readJson(request));
    const { order, created } = await reserveOrder(input, config);
    if (!created) {
      if (order.status === "pending_payment" && order.authorizationUrl && new Date().toISOString() < order.reservationExpiresAt) {
        return Response.json({ orderId: order.reference, reference: order.reference, authorizationUrl: order.authorizationUrl },
          { headers: { "Cache-Control": "no-store" } });
      }
      throw new HttpError(409, "This checkout has already been started. Start a fresh checkout to try again");
    }
    let authorizationUrl: string;
    try {
      const result = await initializePaystack({ secretKey: config.secretKey,
        email: order.email, amountMinor: order.totalMinor, reference: order.reference,
        callbackUrl: `${config.siteUrl}/checkout/return` });
      authorizationUrl = result.authorizationUrl;
    } catch (error) {
      await failInitialization(order.reference);
      throw error;
    }
    const initialized = await markOrderInitialized(order.reference, authorizationUrl);
    if (initialized.status !== "pending_payment" || !initialized.authorizationUrl) {
      throw new HttpError(409, "Checkout state changed. Please contact VEGORA before trying again");
    }
    return Response.json({ orderId: initialized.reference, reference: initialized.reference,
      authorizationUrl: initialized.authorizationUrl }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
