import { revalidateTag } from "next/cache";
import { blockCacheTag, contentCacheTag } from "@/lib/site-content";
import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { publishBlock, requireBlockId } from "@/lib/server/site-content";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ block: string }> }) {
  try {
    const actorUid = await requireAdmin(request);
    const id = requireBlockId((await params).block);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid request");
    const block = await publishBlock(id, (body as Record<string, unknown>).version, actorUid);
    // { expire: 0 } makes the next visitor wait for fresh content instead of
    // being served the old text while it refreshes in the background.
    revalidateTag(contentCacheTag, { expire: 0 });
    revalidateTag(blockCacheTag(id), { expire: 0 });
    return Response.json({ block }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
