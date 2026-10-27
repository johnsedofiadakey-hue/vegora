"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Product } from "./catalog-types";
import { ProductCard } from "./product-card";

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

  if (state === "loading") return <div className="catalog-message" role="status">Loading the collection…</div>;
  if (state === "unavailable") return <div className="catalog-message" role="status"><span>THE COLLECTION</span><h2>Something beautiful is taking shape.</h2><p>VEGORA&apos;s online collection is being prepared. Explore the edit in the meantime.</p><Link href="/the-edit" className="line-link">View the edit →</Link></div>;
  if (!products.length) return <div className="catalog-message" role="status"><span>THE COLLECTION</span><h2>{query ? "No matching pieces yet." : "The collection is coming."}</h2><p>{query ? "Try another search or explore the women’s and men’s collections." : "We’ll reveal pieces here as the VEGORA collection is ready."}</p><div><Link href="/women" className="line-link">Women →</Link><Link href="/men" className="line-link">Men →</Link></div></div>;

  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
