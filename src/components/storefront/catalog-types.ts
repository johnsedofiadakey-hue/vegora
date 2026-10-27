export type ProductImage = { url: string; alt: string };
export type ProductVariant = { id: string; sku: string; size: string; stock: number };

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  audience: "women" | "men" | "unisex";
  category: string;
  priceMinor: number | null;
  currency: "GHS";
  images: ProductImage[];
  variants: ProductVariant[];
  status: "draft" | "published" | "archived";
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export function formatMoney(minor: number | null, currency = "GHS") {
  return minor === null ? "Price unavailable" : new Intl.NumberFormat("en-GH", { style: "currency", currency }).format(minor / 100);
}
