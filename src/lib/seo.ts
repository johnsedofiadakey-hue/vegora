import { imageUrl } from "./image-delivery.ts";

// Search and sharing helpers. Pure functions with no server imports so they can
// be tested directly. Nothing here reads a request.

const fallbackOrigin = "http://localhost:3000";

/** The site's public address, from VEGORA_SITE_URL. Used for absolute links in the sitemap and share previews. */
export function siteOrigin(value: string | undefined = process.env.VEGORA_SITE_URL): string {
  try {
    const url = new URL((value ?? "").trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallbackOrigin;
    return url.origin;
  } catch {
    return fallbackOrigin;
  }
}

/**
 * Search engines are kept out until launch. The preview shows test prices and
 * unfinished pieces, so indexing it would put them in search results. Launch
 * sets VEGORA_ALLOW_INDEXING=true.
 */
export function indexingAllowed(value: string | undefined = process.env.VEGORA_ALLOW_INDEXING): boolean {
  return (value ?? "").trim() === "true";
}

/** JSON for a <script type="application/ld+json"> tag, with characters that could end the tag escaped. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
}

/** Plain text cut to a length that suits a search result, ending on a word. */
export function summarize(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

export function absoluteUrl(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** A photograph at a size that suits link previews, so a large upload is never what gets shared. */
export function shareImageUrl(origin: string, imagePath: string): string {
  return absoluteUrl(origin, imageUrl(imagePath, 1200, 75));
}

interface ProductForMarkup {
  slug: string;
  name: string;
  description: string;
  category: string;
  priceMinor: number | null;
  currency: string;
  images: { url: string; alt: string }[];
}

/** Product markup for search results. Only call it for a published piece that is in stock. */
export function productJsonLd(product: ProductForMarkup, origin: string) {
  if (product.priceMinor === null) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || `${product.name} from VEGORA.`,
    category: product.category,
    sku: product.slug,
    brand: { "@type": "Brand", name: "VEGORA" },
    image: product.images.slice(0, 5).map((image) => shareImageUrl(origin, image.url)),
    offers: {
      "@type": "Offer",
      url: `${origin}/product/${product.slug}`,
      priceCurrency: product.currency,
      price: (product.priceMinor / 100).toFixed(2),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

export function organizationJsonLd(origin: string, instagram: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "VEGORA",
    url: origin,
    logo: `${origin}/icon.svg`,
    ...(instagram ? { sameAs: [`https://instagram.com/${instagram}`] } : {}),
  };
}

export interface SitemapInput {
  womenAvailable: boolean;
  productSlugs: string[];
  /** Paths of delivery, returns, privacy, terms and contact pages that have text. */
  livePolicyPaths: string[];
}

/** Every public page worth listing. Hidden pages (empty policies, women's collection without stock) are left out. */
export function sitemapPaths(input: SitemapInput): { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] {
  const entries: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/men", priority: 0.9, changeFrequency: "daily" },
    ...(input.womenAvailable ? [{ path: "/women", priority: 0.9, changeFrequency: "daily" as const }] : []),
    { path: "/new-in", priority: 0.9, changeFrequency: "daily" },
    { path: "/the-edit", priority: 0.6, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    ...input.productSlugs.map((slug) => ({ path: `/product/${slug}`, priority: 0.8, changeFrequency: "weekly" as const })),
    ...input.livePolicyPaths.map((path) => ({ path, priority: 0.4, changeFrequency: "monthly" as const })),
  ];
  const seen = new Set<string>();
  return entries.filter((entry) => !seen.has(entry.path) && seen.add(entry.path));
}
