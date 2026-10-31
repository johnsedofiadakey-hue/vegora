import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { getBlockDetail, requireBlockId, saveBlockDraft } from "@/lib/server/site-content";

export const runtime = "nodejs";

type Context = { params: Promise<{ block: string }> };
const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: Request, { params }: Context) {
  try {
    await requireAdmin(request);
    const id = requireBlockId((await params).block);
    return Response.json({ block: await getBlockDetail(id) }, noStore);
  } catch (error) {
    return jsonError(error);
  }
}

// Saves a draft. Nothing changes on the storefront until the section is published.
export async function PUT(request: Request, { params }: Context) {
  try {
    const actorUid = await requireAdmin(request);
    const id = requireBlockId((await params).block);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid request");
    const { values, version } = body as Record<string, unknown>;
    return Response.json({ block: await saveBlockDraft(id, values, version, actorUid) }, noStore);
  } catch (error) {
    return jsonError(error);
  }
}
