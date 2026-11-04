"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, ShoppingCart, X } from "lucide-react";
import { Product, ProductVariant, formatMoney } from "./catalog-types";
import { addToBag, readBag } from "./bag-store";
import { WishlistButton } from "./wishlist-button";

type QuickAdd = "idle" | "sizes" | "added" | "full";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  const href = `/product/${encodeURIComponent(product.slug)}`;
  const inStock = product.variants.filter((variant) => variant.stock > 0);
  const [step, setStep] = useState<QuickAdd>("idle");

  // The confirmation clears itself so the card is ready for another add.
  useEffect(() => {
    if (step !== "added" && step !== "full") return;
    const timer = window.setTimeout(() => setStep("idle"), 2600);
    return () => window.clearTimeout(timer);
  }, [step]);

  function add(variant: ProductVariant) {
    const inBag = readBag().find((item) => item.key === `${product.id}:${variant.id}`)?.quantity ?? 0;
    if (inBag >= variant.stock) { setStep("full"); return; }
    try { addToBag(product, variant, 1); setStep("added"); } catch { setStep("idle"); }
  }

  // One size in stock needs no choice; otherwise the sizes open on the card.
  function start() {
    if (inStock.length === 1) add(inStock[0]);
    else setStep("sizes");
  }

  return <div className="product-card"><Link href={href}>
    <div className="product-card-image">
      {image ? <Image src={image.url} alt={image.alt || product.name} width={600} height={800} sizes="(max-width: 767px) 50vw, 33vw" /> : <span>VEGORA</span>}
      {!!product.tags?.length && <div className="product-card-tags">{product.tags.map((tag) => <span key={tag}>{tag === "new_arrival" ? "New arrival" : "Best seller"}</span>)}</div>}
    </div>
    <div className="product-card-meta"><div><span>{product.category}</span><h3>{product.name}</h3></div><strong>{formatMoney(product.priceMinor, product.currency)}</strong></div>
  </Link>
    <WishlistButton slug={product.slug} name={product.name} variant="card" />
    <div className="quick-add">
      {product.priceMinor === null || inStock.length === 0
        ? <button type="button" className="quick-add-button" disabled>Sold out</button>
        : step === "sizes"
          ? <div role="group" aria-label={`Choose a size of ${product.name}`}>
            <div className="quick-add-head"><span>Choose a size</span><button type="button" aria-label="Close sizes" onClick={() => setStep("idle")}><X size={14} aria-hidden="true" /></button></div>
            <div className="quick-add-sizes">{product.variants.map((variant) => <button key={variant.id} type="button" disabled={variant.stock < 1} onClick={() => add(variant)} aria-label={`Add size ${variant.size} to your cart`}>{variant.size}</button>)}</div>
          </div>
          : step === "added"
            ? <p className="quick-add-done" role="status"><Check size={14} aria-hidden="true" />Added. <Link href="/cart">View cart</Link></p>
            : step === "full"
              ? <p className="quick-add-done" role="status">All we have of that size is in your cart.</p>
              : <button type="button" className="quick-add-button" onClick={start}><ShoppingCart size={15} strokeWidth={1.5} aria-hidden="true" />Add to cart</button>}
    </div>
  </div>;
}
