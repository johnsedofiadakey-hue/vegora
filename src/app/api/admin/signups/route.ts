import { requireAdmin } from "@/lib/server/admin-auth";
import { jsonError } from "@/lib/server/http";
import { listSignups } from "@/lib/server/signups";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return Response.json(await listSignups(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
