import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { discardBlockDraft, requireBlockId } from "@/lib/server/site-content";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ block: string }> }) {
  try {
    await requireAdmin(request);
    const id = requireBlockId((await params).block);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid request");
    return Response.json({ block: await discardBlockDraft(id, (body as Record<string, unknown>).version) },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
