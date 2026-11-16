export type ProductImage = { url: string; alt: string };
export type ProductVariant = { id: string; sku: string; size: string; stock: number };
export type ProductTag = "new_arrival" | "best_seller";

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
  tags: ProductTag[];
  createdAt: string;
  updatedAt: string;
};

// Written out by hand, not with Intl.NumberFormat: the server and every phone then print exactly the same
// text. (A phone whose language data differs would otherwise print a different symbol than the page
// the server sent, and the page would be rebuilt in the browser.)
export function formatMoney(minor: number | null, currency = "GHS") {
  if (minor === null) return "Price unavailable";
  const symbol = currency === "GHS" ? "GH₵" : `${currency} `;
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${symbol}${whole}.${String(abs % 100).padStart(2, "0")}`;
}
