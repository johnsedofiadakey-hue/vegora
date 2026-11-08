import { requireAdmin } from "@/lib/server/admin-auth";
import { jsonError, readJson } from "@/lib/server/http";
import { deleteVoucher, updateVoucher } from "@/lib/server/vouchers";

export const runtime = "nodejs";

// Turn a voucher on or off, change its note, extend its last day or raise its total uses.
// The percentage can never be changed.
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const uid = await requireAdmin(request);
    const voucher = await updateVoucher((await params).code, await readJson(request), uid);
    return Response.json({ voucher }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

// Only a voucher that was never used can be deleted.
export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const uid = await requireAdmin(request);
    await deleteVoucher((await params).code, uid);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
