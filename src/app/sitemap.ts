import type { MetadataRoute } from "next";
import { contactChannels, policyIsLive } from "@/lib/site-content";
import { siteOrigin, sitemapPaths } from "@/lib/seo";
import { hasAvailableProductsForAudience, listPublishedProducts } from "@/lib/server/products";
import { getContent } from "@/lib/server/site-content-cache";
import { withTimeout } from "@/lib/server/timeout";

export const dynamic = "force-dynamic";

// Lists only pages that exist: a collection with no stock or a policy with no
// text is left out. If the catalog cannot be read, the fixed pages still list.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const [womenAvailable, products, delivery, returns, privacy, terms, contact] = await Promise.all([
    withTimeout(hasAvailableProductsForAudience("women"), 3000).catch(() => false),
    withTimeout(listPublishedProducts(null, 500), 3000).catch(() => []),
    getContent("delivery"), getContent("returns"), getContent("privacy"), getContent("terms"), getContent("contact"),
  ]);
  const livePolicyPaths = [
    policyIsLive(delivery) ? "/delivery" : "", policyIsLive(returns) ? "/returns" : "",
    policyIsLive(privacy) ? "/privacy" : "", policyIsLive(terms) ? "/terms" : "",
    contactChannels(contact).length > 0 ? "/contact" : "",
  ].filter(Boolean);
  const now = new Date();
  return sitemapPaths({ womenAvailable, productSlugs: products.map((product) => product.slug), livePolicyPaths })
    .map(({ path, priority, changeFrequency }) => ({ url: `${origin}${path}`, lastModified: now, changeFrequency, priority }));
}
