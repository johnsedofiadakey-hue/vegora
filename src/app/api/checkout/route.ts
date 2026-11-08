import { checkoutConfig } from "@/lib/server/checkout-config";
import { jsonError, readJson, HttpError } from "@/lib/server/http";
import { failInitialization, parseCheckoutInput, reserveOrder, markOrderInitialized } from "@/lib/server/orders";
import { initializePaystack } from "@/lib/server/paystack";
import { clientAddress, createRateLimiter, rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// Every new checkout holds stock for 30 minutes, so starting them is limited.
const perContact = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });
const perCaller = createRateLimiter({ limit: 12, windowMs: 10 * 60_000 });
// Trying vouchers at checkout counts against the same brake as the voucher check page.
const perCallerVoucher = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  try {
    const config = checkoutConfig();
    const caller = perCaller.check(clientAddress(request));
    if (!caller.ok) return rateLimited(caller.retryAfterSeconds);
    const input = parseCheckoutInput(await readJson(request));
    if (input.voucherCode) {
      const voucherTry = perCallerVoucher.check(clientAddress(request));
      if (!voucherTry.ok) return rateLimited(voucherTry.retryAfterSeconds);
    }
    const contact = perContact.check(input.email);
    if (!contact.ok) return rateLimited(contact.retryAfterSeconds);
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
