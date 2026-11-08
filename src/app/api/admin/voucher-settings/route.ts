import { requireAdmin } from "@/lib/server/admin-auth";
import { jsonError, readJson } from "@/lib/server/http";
import { saveVoucherSettings } from "@/lib/server/vouchers";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const uid = await requireAdmin(request);
    const settings = await saveVoucherSettings(await readJson(request), uid);
    return Response.json({ settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
