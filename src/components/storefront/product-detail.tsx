"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { addToBag } from "./bag-store";
import { Product, formatMoney } from "./catalog-types";

export function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Product unavailable"); return response.json() as Promise<{ product: Product }>; })
      .then(({ product }) => { setProduct(product); setVariantId(product.variants.find((variant) => variant.stock > 0)?.id || ""); setState("ready"); })
      .catch((error: unknown) => { if ((error as Error).name !== "AbortError") setState("missing"); });
    return () => controller.abort();
  }, [slug]);

  if (state === "loading") return <div className="product-state" role="status">Loading piece…</div>;
  if (state === "missing" || !product) return <div className="product-state"><h1>Piece unavailable.</h1><p>This piece may have moved or is not currently available online.</p><Link className="line-link" href="/new-in">Explore the collection <ArrowUpRight size={16} /></Link></div>;
  const chosenVariant = product.variants.find((variant) => variant.id === variantId);
  const soldOut = !chosenVariant || chosenVariant.stock < 1 || product.priceMinor === null;

  function add() {
    if (!chosenVariant || soldOut) return;
    try { addToBag(product!, chosenVariant, quantity); setFeedback("Added to your bag."); }
    catch { setFeedback("Your browser could not save this bag. Please try again."); }
  }

  return <div className="product-page">
    <div className="product-gallery">
      <div className="product-main-image">{product.images[activeImage] ? <Image src={product.images[activeImage].url} alt={product.images[activeImage].alt || product.name} width={800} height={1000} unoptimized /> : <span>VEGORA</span>}</div>
      {product.images.length > 1 && <div className="product-thumbnails" aria-label="Product images">{product.images.map((image, index) => <button key={`${image.url}-${index}`} type="button" aria-label={`Show image ${index + 1}`} aria-pressed={activeImage === index} onClick={() => setActiveImage(index)}><Image src={image.url} alt="" width={80} height={100} unoptimized /></button>)}</div>}
    </div>
    <div className="product-info"><Link href="/new-in" className="product-back"><ArrowLeft size={16} /> Back to collection</Link><span className="eyebrow">VEGORA / {product.category}</span><h1>{product.name}</h1><p className="product-price">{formatMoney(product.priceMinor, product.currency)}</p><p className="product-description">{product.description}</p>
      <fieldset className="size-picker"><legend>Select size</legend><div>{product.variants.map((variant) => <button key={variant.id} type="button" disabled={variant.stock < 1} aria-pressed={variantId === variant.id} onClick={() => { setVariantId(variant.id); setQuantity(1); setFeedback(""); }}>{variant.size}</button>)}</div></fieldset>
      <p className="stock-note">{soldOut ? "Currently unavailable" : `${chosenVariant.stock} available in this size`}</p>
      <div className="quantity-picker"><span>Quantity</span><div><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><strong>{quantity}</strong><button type="button" aria-label="Increase quantity" disabled={!chosenVariant || quantity >= chosenVariant.stock} onClick={() => setQuantity(Math.min(chosenVariant?.stock || 1, quantity + 1))}><Plus size={16} /></button></div></div>
      <button className="add-bag-button" type="button" disabled={soldOut} onClick={add}>{soldOut ? "Unavailable" : "Add to bag"} <ArrowUpRight size={18} /></button><p className="product-feedback" role="status">{feedback}</p>
      <div className="product-disclosure"><h2>Details</h2><p>{product.description}</p></div>
    </div>
  </div>;
}
