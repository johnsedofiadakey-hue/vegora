import { FulfillmentInputError, parseTrackingLookup, publicTrackingView } from "@/lib/fulfillment";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { findOrderForTracking, listFulfillmentEvents } from "@/lib/server/orders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let lookup: ReturnType<typeof parseTrackingLookup>;
    try {
      lookup = parseTrackingLookup(await readJson(request));
    } catch (error) {
      if (error instanceof FulfillmentInputError) throw new HttpError(400, error.message);
      throw error;
    }
    // A wrong number and a wrong email give the same answer, so nobody can
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
