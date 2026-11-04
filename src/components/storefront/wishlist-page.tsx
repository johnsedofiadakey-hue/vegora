"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "./catalog-types";
import { ProductCard } from "./product-card";
import { WomenOnly } from "./collection-availability";
import { removeFromWishlist, useWishlist } from "./wishlist-store";

type Loaded = { slug: string; product: Product | null };

export function WishlistPage() {
  const slugs = useWishlist();
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState<Map<string, Product | null>>(new Map());

  useEffect(() => { const timer = window.setTimeout(() => setMounted(true), 0); return () => window.clearTimeout(timer); }, []);

  // Load each saved piece fresh, so the price and sizes are current. A piece
  // that has been taken off the shop comes back as null.
  useEffect(() => {
    const missing = slugs.filter((slug) => !loaded.has(slug));
    if (!missing.length) return;
    const controller = new AbortController();
    Promise.all(missing.map((slug): Promise<Loaded> => fetch(`/api/products/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) return { slug, product: null };
        if (!response.ok) throw new Error(`Product ${response.status}`);
        return { slug, product: ((await response.json()) as { product: Product }).product };
      })))
      .then((results) => setLoaded((current) => { const next = new Map(current); for (const { slug, product } of results) next.set(slug, product); return next; }))
      .catch(() => { /* a network error: try again on the next change */ });
    return () => controller.abort();
  }, [slugs, loaded]);

  const ready = mounted && slugs.every((slug) => loaded.has(slug));
  const available = slugs.map((slug) => loaded.get(slug)).filter((product): product is Product => !!product);
  const gone = slugs.filter((slug) => loaded.get(slug) === null);

  return <div className="bag-page wishlist-page section-pad"><span className="eyebrow">VEGORA / WISHLIST</span><h1>Your wishlist</h1>
    {!mounted ? <p>Loading your wishlist…</p> : !slugs.length ? <div className="bag-empty"><h2>Your wishlist is empty.</h2><p>Tap the heart on anything you like and it will be saved here, on this device.</p><div><Link className="line-link" href="/men">Shop men <ArrowUpRight size={16} /></Link><WomenOnly><Link className="line-link" href="/women">Shop women <ArrowUpRight size={16} /></Link></WomenOnly></div></div> : <>
      <p className="wishlist-note">{slugs.length} saved {slugs.length === 1 ? "piece" : "pieces"}. Your wishlist is kept on this device.</p>
      {!ready && !available.length ? <p role="status">Loading your wishlist…</p> : <div className="product-grid">{available.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      {gone.length > 0 && <div className="wishlist-gone"><p>{gone.length === 1 ? "One saved piece is" : `${gone.length} saved pieces are`} no longer in the shop.</p><button type="button" className="line-link" onClick={() => gone.forEach(removeFromWishlist)}>Remove {gone.length === 1 ? "it" : "them"}</button></div>}
    </>}
  </div>;
}
