import type { Metadata } from "next";
import { cache } from "react";
import { ProductDetail } from "@/components/storefront/product-detail";
import { findPreviewProduct } from "@/lib/preview-products";
import { jsonLd, productJsonLd, shareImageUrl, siteOrigin, summarize } from "@/lib/seo";
import { getPublishedProduct } from "@/lib/server/products";
import { withTimeout } from "@/lib/server/timeout";

type Props = { params: Promise<{ slug: string }> };

// One lookup serves both the page's metadata and its markup. If the catalog
// cannot be read the page still works: the browser loads the piece itself.
const loadProduct = cache(async (slug: string) => {
  try { return await withTimeout(getPublishedProduct(slug), 3000); } catch { return null; }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (product) {
    const description = summarize(product.description || `${product.name} from VEGORA.`);
    const image = product.images[0] ? [{ url: shareImageUrl(siteOrigin(), product.images[0].url), alt: product.images[0].alt || product.name }] : undefined;
    return {
      title: product.name, description, alternates: { canonical: `/product/${slug}` },
      openGraph: { type: "website", siteName: "VEGORA", title: product.name, description, images: image },
      twitter: { card: "summary_large_image", title: product.name, description, images: image?.map((entry) => entry.url) },
    };
  }
  // Preview pieces and unknown addresses are not for sale, so they stay out of search.
  const preview = findPreviewProduct(slug);
  return preview
    ? { title: preview.name, description: summarize(preview.description), robots: { index: false, follow: true } }
    : { title: "Piece unavailable", robots: { index: false, follow: false } };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  const markup = product ? productJsonLd(product, siteOrigin()) : null;
  return <>
    {markup && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(markup) }} />}
    <ProductDetail key={slug} slug={slug} />
  </>;
}
