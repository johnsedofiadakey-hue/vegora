import { jsonError } from "@/lib/server/http";
import { listPublishedProducts, searchPublishedProducts } from "@/lib/server/products";
import type { Audience } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const audience = url.searchParams.get("audience");
    if (audience && !["women", "men", "unisex"].includes(audience)) {
      return Response.json({ error: "Invalid audience" }, { status: 400 });
    }
    const requested = Number(url.searchParams.get("limit") ?? 12);
    if (!Number.isInteger(requested) || requested < 1 || requested > 48) {
      return Response.json({ error: "Limit must be between 1 and 48" }, { status: 400 });
    }
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length > 100) return Response.json({ error: "Search is too long" }, { status: 400 });
    const products = q
      ? await searchPublishedProducts(q, audience as Audience | null, requested)
      : await listPublishedProducts(audience as Audience | null, requested);
    return Response.json({ products }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    return jsonError(error);
  }
}
