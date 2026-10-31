import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { forgetContent } from "@/lib/server/site-content-cache";
import { publishBlock, requireBlockId } from "@/lib/server/site-content";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ block: string }> }) {
  try {
    const actorUid = await requireAdmin(request);
    const id = requireBlockId((await params).block);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid request");
    const block = await publishBlock(id, (body as Record<string, unknown>).version, actorUid);
    // The storefront renders per request and keeps a short in-process copy of
    // each block. Drop it so this instance shows the new text immediately;
    // other instances pick it up when their copy expires.
    forgetContent(id);
    return Response.json({ block }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
