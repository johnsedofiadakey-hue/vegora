import { FulfillmentInputError, parseTrackingLookup, publicTrackingView, trackingLookupMatches } from "@/lib/fulfillment";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { getOrder, listFulfillmentEvents } from "@/lib/server/orders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let lookup: { reference: string; email: string };
    try {
      lookup = parseTrackingLookup(await readJson(request));
    } catch (error) {
      if (error instanceof FulfillmentInputError) throw new HttpError(400, error.message);
      throw error;
    }
    const order = await getOrder(lookup.reference);
    if (!order || !trackingLookupMatches(order, lookup.email)) {
      throw new HttpError(404, "No order matches those details");
    }
    const events = await listFulfillmentEvents(lookup.reference);
    return Response.json({ tracking: publicTrackingView(order, events) }, { headers: {
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    } });
  } catch (error) {
    return jsonError(error);
  }
}
