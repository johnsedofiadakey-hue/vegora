import "server-only";

import type { Audience, ProductImage, ProductInput, ProductStatus, ProductVariant } from "../catalog";
import { HttpError } from "./http";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Product must be an object");
  }
  return value as Record<string, unknown>;
}

function field(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") throw new HttpError(400, `${label} must be text`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) {
    throw new HttpError(400, `${label} must be ${required ? "1" : "0"}–${max} characters`);
  }
  return clean;
}

const mediaPath = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp|avif)$/i;

export function parseProductInput(value: unknown): ProductInput {
  const input = object(value);
  const slug = field(input.slug, "Slug", 80).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(400, "Slug must contain lowercase letters, numbers and hyphens only");
  }
  const name = field(input.name, "Name", 140);
  const description = field(input.description, "Description", 5000, false);
  const category = field(input.category, "Category", 80);
  if (!["women", "men", "unisex"].includes(String(input.audience))) {
    throw new HttpError(400, "Choose Women, Men or Unisex");
  }
  const audience = input.audience as Audience;
  if (!["draft", "published", "archived"].includes(String(input.status))) {
    throw new HttpError(400, "Invalid product status");
  }
  const status = input.status as ProductStatus;
  if (input.currency !== "GHS") throw new HttpError(400, "Currency must be GHS");
  const priceMinor = input.priceMinor;
  if (priceMinor !== null && (!Number.isSafeInteger(priceMinor) || Number(priceMinor) < 0 || Number(priceMinor) > 100_000_000_00)) {
    throw new HttpError(400, "Price must be a valid amount in pesewas");
  }
  if (!Array.isArray(input.images) || input.images.length > 12) {
    throw new HttpError(400, "Use up to 12 images");
  }
  const images: ProductImage[] = input.images.map((value) => {
    const image = object(value);
    const url = field(image.url, "Image URL", 150);
    if (!mediaPath.test(url)) throw new HttpError(400, "Upload images through the admin first");
    return { url, alt: field(image.alt, "Image description", 200) };
  });
  if (!Array.isArray(input.variants) || input.variants.length > 50) {
    throw new HttpError(400, "Use up to 50 size variants");
  }
  const variants: ProductVariant[] = input.variants.map((value) => {
    const variant = object(value);
    const id = field(variant.id, "Variant ID", 80);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new HttpError(400, "Variant ID is invalid");
    const sku = field(variant.sku, "SKU", 80).toUpperCase();
    const size = field(variant.size, "Size", 40);
    if (!/^[A-Z0-9_-]+$/.test(sku)) throw new HttpError(400, "SKU may use letters, numbers, dashes and underscores");
    if (!Number.isSafeInteger(variant.stock) || Number(variant.stock) < 0 || Number(variant.stock) > 1_000_000) {
      throw new HttpError(400, "Stock must be a non-negative whole number");
    }
    return { id, sku, size, stock: Number(variant.stock) };
  });
  if (new Set(variants.map((variant) => variant.id)).size !== variants.length ||
      new Set(variants.map((variant) => variant.sku)).size !== variants.length) {
    throw new HttpError(400, "Variant IDs and SKUs must be unique within a product");
  }
  if (typeof input.featured !== "boolean") throw new HttpError(400, "Featured must be true or false");
  if (status === "published" && (priceMinor === null || images.length === 0 || variants.length === 0)) {
    throw new HttpError(400, "Published products need a price, image and size variant");
  }
  return {
    slug, name, description, audience, category, priceMinor: priceMinor as number | null,
    currency: "GHS", images, variants, status, featured: input.featured,
  };
}
