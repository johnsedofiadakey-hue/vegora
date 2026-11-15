import { requireAdmin } from "@/lib/server/admin-auth";
import { getDeliveryState, saveDeliveryAreas } from "@/lib/server/delivery-settings";
import { jsonError, readJson } from "@/lib/server/http";
import { createRateLimiter, rateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const perAdmin = createRateLimiter({ limit: 20, windowMs: 60_000 });

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return Response.json(await getDeliveryState(true), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const uid = await requireAdmin(request);
    const limit = perAdmin.check(uid);
    if (!limit.ok) return rateLimited(limit.retryAfterSeconds);
    const state = await saveDeliveryAreas(await readJson(request), uid);
    return Response.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
