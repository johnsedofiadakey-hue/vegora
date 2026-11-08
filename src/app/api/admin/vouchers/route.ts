import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { createRateLimiter, rateLimited } from "@/lib/server/rate-limit";
import { createVouchers, getVoucherSettings, listVouchers } from "@/lib/server/vouchers";

export const runtime = "nodejs";

const perAdmin = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const [list, settings] = await Promise.all([listVouchers(), getVoucherSettings(true)]);
    return Response.json({ ...list, settings, now: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const uid = await requireAdmin(request);
    const limit = perAdmin.check(uid);
    if (!limit.ok) return rateLimited(limit.retryAfterSeconds);
    const body = await readJson(request);
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid voucher details");
    const created = await createVouchers(body, uid);
    return Response.json({ vouchers: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
