export type Audience = "women" | "men" | "unisex";
export type ProductStatus = "draft" | "published" | "archived";

export interface ProductImage {
  url: string;
  alt: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  audience: Audience;
  category: string;
  priceMinor: number | null;
  currency: "GHS";
  images: ProductImage[];
  variants: ProductVariant[];
  status: ProductStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  slug: string;
  name: string;
  description: string;
  audience: Audience;
  category: string;
  priceMinor: number | null;
  currency: "GHS";
  images: ProductImage[];
  variants: ProductVariant[];
  status: ProductStatus;
  featured: boolean;
}

export function formatGhs(priceMinor: number | null): string {
  return priceMinor === null
    ? "Price on request"
    : new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(priceMinor / 100);
}
