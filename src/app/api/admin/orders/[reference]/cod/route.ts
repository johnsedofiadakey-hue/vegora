import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { cancelCodOrder, confirmCodOrder, listFulfillmentEvents } from "@/lib/server/orders";

export const runtime = "nodejs";

type Context = { params: Promise<{ reference: string }> };

// Two actions on a pay-on-delivery order: "confirm" (the admin rang the customer) and "cancel".
export async function POST(request: Request, { params }: Context) {
  try {
    const actorUid = await requireAdmin(request);
    const { reference } = await params;
    const body = await readJson(request);
    const value = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
    let order;
    if (value.action === "confirm") order = await confirmCodOrder(reference, actorUid);
    else if (value.action === "cancel") order = await cancelCodOrder(reference, value.reason, actorUid);
    else throw new HttpError(400, "Choose confirm or cancel");
    const events = await listFulfillmentEvents(reference);
    return Response.json({ order, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
