import { requireAdmin } from "@/lib/server/admin-auth";
import { jsonError } from "@/lib/server/http";
import { listAdminBlocks } from "@/lib/server/site-content";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return Response.json({ blocks: await listAdminBlocks() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
