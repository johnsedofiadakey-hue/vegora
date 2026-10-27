import { jsonError } from "@/lib/server/http";
import { getPublishedProduct } from "@/lib/server/products";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const product = await getPublishedProduct(slug);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    return Response.json({ product }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    return jsonError(error);
  }
}
