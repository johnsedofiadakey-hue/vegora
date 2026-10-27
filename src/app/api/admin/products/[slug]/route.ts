import { requireAdmin } from "@/lib/server/admin-auth";
import { jsonError, readJson } from "@/lib/server/http";
import { archiveProduct, getAdminProduct, updateProduct } from "@/lib/server/products";
import { parseProductInput } from "@/lib/server/product-validation";

export const runtime = "nodejs";

type Context = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { slug } = await context.params;
    const product = await getAdminProduct(slug);
    if (!product) return Response.json({ error: "Product not found" }, { status: 404 });
    return Response.json({ product }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { slug } = await context.params;
    const input = parseProductInput(await readJson(request));
    const product = await updateProduct(slug, input);
    return Response.json({ product }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { slug } = await context.params;
    const product = await archiveProduct(slug);
    return Response.json({ product }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
