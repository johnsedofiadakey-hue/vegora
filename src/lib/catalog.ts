export type Audience = "women" | "men" | "unisex";
export type ProductStatus = "draft" | "published" | "archived";
export type ProductTag = "new_arrival" | "best_seller";

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
  tags: ProductTag[];
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
  tags: ProductTag[];
}

// Written out by hand so every device prints exactly the same text as the server (see formatMoney).
export function formatGhs(priceMinor: number | null): string {
  if (priceMinor === null) return "Price on request";
  const sign = priceMinor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(priceMinor));
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}GH₵${whole}.${String(abs % 100).padStart(2, "0")}`;
}
