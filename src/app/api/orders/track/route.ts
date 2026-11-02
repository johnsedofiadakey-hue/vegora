import { FulfillmentInputError, parseTrackingLookup, publicTrackingView } from "@/lib/fulfillment";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { findOrderForTracking, listFulfillmentEvents } from "@/lib/server/orders";
import { clientAddress, createRateLimiter, rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// Guessing an order needs both its number and the buyer's phone number. Counting per
// phone number stops anyone brute-forcing the number for a known contact, even if they
// change their own address; counting per caller slows general probing.
const perContact = createRateLimiter({ limit: 8, windowMs: 10 * 60_000 });
const perCaller = createRateLimiter({ limit: 40, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  try {
    const caller = perCaller.check(clientAddress(request));
    if (!caller.ok) return rateLimited(caller.retryAfterSeconds);
    let lookup: ReturnType<typeof parseTrackingLookup>;
    try {
      lookup = parseTrackingLookup(await readJson(request));
    } catch (error) {
      if (error instanceof FulfillmentInputError) throw new HttpError(400, error.message);
      throw error;
    }
    const contact = perContact.check(lookup.email ?? `phone:${lookup.phoneKey}`);
    if (!contact.ok) return rateLimited(contact.retryAfterSeconds);
    // A wrong number and a wrong phone number give the same answer, so nobody can
    // use this page to find out which order numbers exist.
    const order = await findOrderForTracking(lookup);
    if (!order) throw new HttpError(404, "No order matches those details");
    const events = await listFulfillmentEvents(order.reference);
    return Response.json({ tracking: publicTrackingView(order, events) }, { headers: {
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    return jsonError(error);
  }
}
