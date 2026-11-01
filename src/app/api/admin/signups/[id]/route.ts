import { requireAdmin } from "@/lib/server/admin-auth";
import { jsonError } from "@/lib/server/http";
import { deleteSignup } from "@/lib/server/signups";

export const runtime = "nodejs";

// Removes a person from the list, for example when they ask to be taken off.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    await deleteSignup((await params).id);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
