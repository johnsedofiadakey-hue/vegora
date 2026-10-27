import { requireAdmin } from "@/lib/server/admin-auth";
import { jsonError, readJson } from "@/lib/server/http";
import { createProduct, listAdminProducts } from "@/lib/server/products";
import { parseProductInput } from "@/lib/server/product-validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const products = await listAdminProducts();
    return Response.json({ products }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = parseProductInput(await readJson(request));
    const product = await createProduct(input);
    return Response.json({ product }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
