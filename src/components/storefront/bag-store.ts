import type { Product, ProductVariant } from "./catalog-types";

export type BagItem = {
  key: string;
  productId: string;
  slug: string;
  name: string;
  image?: string;
  imageAlt?: string;
  variantId: string;
  size: string;
  priceMinor: number;
  currency: string;
  quantity: number;
};

const BAG_KEY = "vegora-bag-v1";

export function readBag(): BagItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(BAG_KEY) || "[]") as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is BagItem =>
      !!item && typeof item === "object" && typeof item.key === "string" && typeof item.quantity === "number" && item.quantity > 0
    );
  } catch { return []; }
}

export function writeBag(items: BagItem[]) {
  window.localStorage.setItem(BAG_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("vegora-bag-change"));
}

export function addToBag(product: Product, variant: ProductVariant, quantity: number) {
  if (product.priceMinor === null) throw new Error("Price unavailable");
  const key = `${product.id}:${variant.id}`;
  const items = readBag();
  const existing = items.find((item) => item.key === key);
  if (existing) existing.quantity = Math.min(variant.stock, existing.quantity + quantity);
  else items.push({ key, productId: product.id, slug: product.slug, name: product.name, image: product.images[0]?.url, imageAlt: product.images[0]?.alt, variantId: variant.id, size: variant.size, priceMinor: product.priceMinor, currency: product.currency, quantity: Math.min(variant.stock, quantity) });
  writeBag(items);
}
