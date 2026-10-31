import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { requireBlockId, restoreBlockRevision } from "@/lib/server/site-content";

export const runtime = "nodejs";

// Loads an earlier published version into the draft. It goes live only when published again.
export async function POST(request: Request, { params }: { params: Promise<{ block: string }> }) {
  try {
    const actorUid = await requireAdmin(request);
    const id = requireBlockId((await params).block);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid request");
    const { revisionId, version } = body as Record<string, unknown>;
    if (typeof revisionId !== "string") throw new HttpError(400, "Choose a version to restore");
    return Response.json({ block: await restoreBlockRevision(id, revisionId, version, actorUid) },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
