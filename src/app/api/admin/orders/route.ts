import { requireAdmin } from "@/lib/server/admin-auth";
import { jsonError } from "@/lib/server/http";
import { listAdminOrders } from "@/lib/server/orders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { orders, truncated } = await listAdminOrders();
    return Response.json({ orders, truncated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
