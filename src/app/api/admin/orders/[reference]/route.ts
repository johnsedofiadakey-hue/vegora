import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { getOrder, listFulfillmentEvents, updateOrderFulfillment } from "@/lib/server/orders";

export const runtime = "nodejs";

type Context = { params: Promise<{ reference: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    await requireAdmin(request);
    const { reference } = await params;
    const order = await getOrder(reference);
    if (!order) throw new HttpError(404, "Order not found");
    const events = await listFulfillmentEvents(reference);
    return Response.json({ order, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actorUid = await requireAdmin(request);
    const { reference } = await params;
    const order = await updateOrderFulfillment(reference, await readJson(request), actorUid);
    const events = await listFulfillmentEvents(reference);
    return Response.json({ order, events }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
