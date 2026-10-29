import { previewPriceMinor, previewProducts } from "@/lib/preview-products";
import { requireAdmin } from "@/lib/server/admin-auth";
import { HttpError, jsonError } from "@/lib/server/http";
import { parseProductInput } from "@/lib/server/product-validation";
import { createProduct } from "@/lib/server/products";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (previewProducts.length !== 7 || new Set(previewProducts.map((product) => product.slug)).size !== 7) {
      throw new HttpError(503, "Preview catalog needs review before import");
    }
    const created: string[] = [];
    const skipped: string[] = [];

    for (const preview of previewProducts) {
      const input = parseProductInput({
        slug: preview.slug,
        name: preview.name,
        description: preview.description,
        audience: preview.audience,
        category: preview.category,
        images: preview.images,
        priceMinor: previewPriceMinor,
        currency: "GHS",
        variants: [],
        status: "draft",
        featured: false,
      });
      try {
        await createProduct(input);
        created.push(input.slug);
      } catch (error) {
        if (error instanceof HttpError && error.status === 409) {
          skipped.push(input.slug);
          continue;
        }
        throw error;
      }
    }

    return Response.json({ created, skipped }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
