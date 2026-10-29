"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { addToBag } from "./bag-store";
import { Product, formatMoney } from "./catalog-types";
import { findPreviewProduct, previewPriceMinor } from "@/lib/preview-products";

function previewRecord(slug: string): Product | null {
  const preview = findPreviewProduct(slug);
  if (!preview) return null;
  return {
    ...preview,
    id: preview.slug,
    priceMinor: previewPriceMinor,
    currency: "GHS",
    variants: [],
    status: "draft",
    featured: false,
    createdAt: "",
    updatedAt: "",
  };
}

export function ProductDetail({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(() => previewRecord(slug));
  const [state, setState] = useState<"loading" | "ready" | "missing">(previewRecord(slug) ? "ready" : "loading");
  const [isPreview, setIsPreview] = useState(Boolean(previewRecord(slug)));
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const preview = previewRecord(slug);
    fetch(`/api/products/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Product unavailable"); return response.json() as Promise<{ product: Product }>; })
      .then(({ product }) => { setProduct(product); setIsPreview(false); setState("ready"); })
      .catch((error: unknown) => { if ((error as Error).name !== "AbortError" && !preview) setState("missing"); });
    return () => controller.abort();
  }, [slug]);

  if (state === "loading") return <div className="product-state" role="status">Loading piece…</div>;
  if (state === "missing" || !product) return <div className="product-state"><h1>Piece unavailable.</h1><p>This piece may have moved or is not currently available online.</p><Link className="line-link" href="/new-in">Explore the collection <ArrowUpRight size={16} /></Link></div>;
  const chosenVariant = product.variants.find((variant) => variant.id === variantId);
  const hasAvailableSize = product.variants.some((variant) => variant.stock > 0);
  const canAdd = !isPreview && !!chosenVariant && chosenVariant.stock > 0 && product.priceMinor !== null;

  function add() {
    if (!chosenVariant || !canAdd) return;
    try { addToBag(product!, chosenVariant, quantity); setFeedback("Added to your bag."); }
    catch { setFeedback("Your browser could not save this bag. Please try again."); }
  }

  return <div className="product-page">
    <div className="product-gallery">
      <div className="product-main-image">{product.images[activeImage] ? <Image src={product.images[activeImage].url} alt={product.images[activeImage].alt || product.name} width={800} height={1000} unoptimized /> : <span>VEGORA</span>}</div>
      {product.images.length > 1 && <div className="product-thumbnails" aria-label="Product images">{product.images.map((image, index) => <button key={`${image.url}-${index}`} type="button" aria-label={`Show image ${index + 1}`} aria-pressed={activeImage === index} onClick={() => setActiveImage(index)}><Image src={image.url} alt="" width={80} height={100} unoptimized /></button>)}</div>}
    </div>
    <div className="product-info"><Link href={isPreview ? "/men" : "/new-in"} className="product-back"><ArrowLeft size={16} /> Back to collection</Link><span className="eyebrow">VEGORA / {product.category}</span><h1>{product.name}</h1><p className="product-price">{formatMoney(product.priceMinor, product.currency)}{isPreview && <span className="test-price-label">Test price</span>}</p><p className="product-description">{product.description}</p>
      {isPreview ? <div className="product-preview-notice"><span>Collection preview</span><p>This piece is in preview. The displayed price is for testing only. Final price and available sizes will be confirmed before ordering opens.</p></div> : <>
        <fieldset className="size-picker"><legend>Select size</legend><div>{product.variants.map((variant) => <button key={variant.id} type="button" disabled={variant.stock < 1} aria-pressed={variantId === variant.id} onClick={() => { setVariantId(variant.id); setQuantity(1); setFeedback(""); }}>{variant.size}</button>)}</div></fieldset>
        <p className="stock-note">{!product.variants.length ? "Sizes will be added soon" : !hasAvailableSize ? "Currently unavailable" : !chosenVariant ? "Choose a size to continue" : `${chosenVariant.stock} available in this size`}</p>
        <div className="quantity-picker"><span>Quantity</span><div><button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={16} /></button><strong>{quantity}</strong><button type="button" aria-label="Increase quantity" disabled={!chosenVariant || quantity >= chosenVariant.stock} onClick={() => setQuantity(Math.min(chosenVariant?.stock || 1, quantity + 1))}><Plus size={16} /></button></div></div>
        <button className="add-bag-button" type="button" disabled={!canAdd} onClick={add}>{canAdd ? "Add to bag" : hasAvailableSize ? "Select a size" : "Unavailable"} <ArrowUpRight size={18} /></button><p className="product-feedback" role="status">{feedback}</p>
      </>}
      {!isPreview && <div className="product-disclosure"><h2>Details</h2><p>{product.description}</p></div>}
    </div>
  </div>;
}
