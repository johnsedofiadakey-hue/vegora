"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Product } from "./catalog-types";
import { ProductCard } from "./product-card";
import { previewProducts } from "@/lib/preview-products";
import { PreviewProductCard } from "./preview-product-card";

type CatalogCollectionProps = { audience?: "women" | "men"; query?: string };

export function CatalogCollection({ audience, query }: CatalogCollectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "48" });
    if (audience) params.set("audience", audience);
    if (query) params.set("q", query);
    fetch(`/api/products?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Catalog ${response.status}`);
        return response.json() as Promise<{ products: Product[] }>;
      })
      .then((data) => { setProducts(data.products || []); setState("ready"); })
      .catch((error: unknown) => { if ((error as Error).name !== "AbortError") setState("unavailable"); });
    return () => controller.abort();
  }, [audience, query]);

  const previewMatches = previewProducts.filter((product) => {
    if (audience && product.audience !== audience) return false;
    if (state === "ready" && products.some((published) => published.slug === product.slug)) return false;
    if (!query) return true;
    const search = `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase();
    return query.toLocaleLowerCase().split(/\s+/).filter(Boolean).every((word) => search.includes(word));
  });

  return <>
    {state === "ready" && products.length > 0 && <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
    {previewMatches.length > 0 && <section className="preview-catalog" aria-label="Product previews">
      <div className="preview-catalog-heading"><span>FROM THE STUDIO / MEN</span><h3>A first look at the pieces.</h3><p>These styles are in preview. GH₵100 is a test price; final prices, sizes, and availability will be confirmed before ordering opens.</p></div>
      <div className="preview-product-grid">{previewMatches.map((product) => <PreviewProductCard key={product.slug} product={product} />)}</div>
    </section>}
    {state === "loading" && !previewMatches.length && <div className="catalog-message" role="status">Loading the collection…</div>}
    {state === "unavailable" && !previewMatches.length && <div className="catalog-message" role="status"><span>THE COLLECTION</span><h2>Something beautiful is taking shape.</h2><p>VEGORA&apos;s online collection is being prepared. Explore the edit in the meantime.</p><Link href="/the-edit" className="line-link">View the edit →</Link></div>}
    {state === "ready" && !products.length && !previewMatches.length && <div className="catalog-message" role="status"><span>THE COLLECTION</span><h2>{query ? "No matching pieces yet." : "The collection is coming."}</h2><p>{query ? "Try another search or explore the women’s and men’s collections." : "We’ll reveal pieces here as the VEGORA collection is ready."}</p><div><Link href="/women" className="line-link">Women →</Link><Link href="/men" className="line-link">Men →</Link></div></div>}
  </>;
}
