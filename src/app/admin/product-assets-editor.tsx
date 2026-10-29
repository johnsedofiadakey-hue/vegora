"use client";

import Image from "next/image";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ProductInput, ProductVariant } from "@/lib/catalog";
import styles from "./product-assets-editor.module.css";

const standardSizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "One size"];

interface Props {
  product: ProductInput;
  onChange: Dispatch<SetStateAction<ProductInput>>;
  onUpload: (files: File[]) => Promise<void>;
  busy: boolean;
}

export function ProductAssetsEditor({ product, onChange, onUpload, busy }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [customSize, setCustomSize] = useState("");
  const [notice, setNotice] = useState("");

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= product.images.length) return;
    onChange((current) => {
      const images = [...current.images];
      const [image] = images.splice(from, 1);
      images.splice(to, 0, image);
      return { ...current, images };
    });
  }

  function addSize(rawSize: string) {
    if (busy) return;
    const size = rawSize.trim();
    if (!size || size.length > 40) {
      setNotice("Enter a size of 1–40 characters.");
      return;
    }
    if (product.variants.some((variant) => variant.size.toLocaleLowerCase() === size.toLocaleLowerCase())) {
      setNotice(`${size} is already in this product.`);
      return;
    }
    if (product.variants.length >= 50) {
      setNotice("A product can have up to 50 sizes.");
      return;
    }
    onChange((current) => ({ ...current, variants: [...current.variants, {
      id: crypto.randomUUID(), sku: "", size, stock: 0,
    }] }));
    setCustomSize("");
    setNotice("");
  }

  function updateVariant(index: number, patch: Partial<ProductVariant>) {
    onChange((current) => ({ ...current, variants: current.variants.map((variant, at) =>
      at === index ? { ...variant, ...patch } : variant) }));
  }

  return <>
    <section className={styles.section} aria-labelledby="product-images-heading">
      <div className={styles.headingRow}>
        <div><p className={styles.eyebrow}>VISUALS</p><h2 id="product-images-heading">Product images</h2></div>
        <button type="button" className={styles.outlineButton} disabled={busy || product.images.length >= 12} onClick={() => fileInput.current?.click()}>+ Add photographs</button>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className={styles.fileInput} aria-label="Choose product photographs" onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) void onUpload(files);
          event.target.value = "";
        }} />
      </div>
      <p className={styles.help}>Select up to 12 photos. The first image is the storefront cover. Use the controls below each photo to change its position.</p>
      <p className={styles.count}>{product.images.length} / 12 images</p>
      {product.images.length > 0 ? <div className={styles.imageGrid}>
        {product.images.map((image, index) => <div key={image.url} className={styles.imageCard}>
          <div className={styles.imageFrame}><Image src={image.url} alt={image.alt} width={300} height={400} unoptimized />{index === 0 && <span className={styles.coverBadge}>COVER</span>}</div>
          <label htmlFor={`image-alt-${index}`}>Image description</label>
          <input id={`image-alt-${index}`} value={image.alt} maxLength={200} onChange={(event) => onChange((current) => ({ ...current, images: current.images.map((item, at) => at === index ? { ...item, alt: event.target.value } : item) }))} />
          <div className={styles.imageActions}>
            {index > 0 && <button type="button" onClick={() => moveImage(index, 0)}>Make cover</button>}
            <button type="button" onClick={() => moveImage(index, index - 1)} disabled={index === 0} aria-label={`Move image ${index + 1} left`}>←</button>
            <button type="button" onClick={() => moveImage(index, index + 1)} disabled={index === product.images.length - 1} aria-label={`Move image ${index + 1} right`}>→</button>
            <button type="button" onClick={() => onChange((current) => ({ ...current, images: current.images.filter((_, at) => at !== index) }))}>Remove</button>
          </div>
        </div>)}
      </div> : <p className={styles.empty}>No product photos yet. Upload original photography before publishing.</p>}
    </section>

    <section className={styles.section} aria-labelledby="product-sizes-heading">
      <div className={styles.headingRow}><div><p className={styles.eyebrow}>INVENTORY</p><h2 id="product-sizes-heading">Sizes & stock</h2></div></div>
      <p className={styles.help}>Select the sizes offered for this item. Each size needs its own SKU. Stock starts at zero until the quantity is verified and entered.</p>
      <div className={styles.sizeChoices} aria-label="Add a standard size">{standardSizes.map((size) => <button type="button" key={size} disabled={busy || product.variants.some((variant) => variant.size.toLocaleLowerCase() === size.toLocaleLowerCase())} onClick={() => addSize(size)}>+ {size}</button>)}</div>
      <div className={styles.customSize}><label htmlFor="custom-product-size">Other size</label><input id="custom-product-size" value={customSize} maxLength={40} placeholder="e.g. EU 42" onChange={(event) => setCustomSize(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSize(customSize); } }} /><button type="button" className={styles.outlineButton} disabled={busy || !customSize.trim()} onClick={() => addSize(customSize)}>Add size</button></div>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {product.variants.length > 0 ? <div className={styles.variantList}>{product.variants.map((variant, index) => <div key={variant.id} className={styles.variantRow}>
        <label>Size<input value={variant.size} maxLength={40} onChange={(event) => updateVariant(index, { size: event.target.value })} required /></label>
        <label>SKU<input value={variant.sku} maxLength={80} placeholder="Enter SKU" onChange={(event) => updateVariant(index, { sku: event.target.value.toUpperCase() })} required /></label>
        <label>Stock<input type="number" min="0" max="1000000" step="1" value={variant.stock} onChange={(event) => updateVariant(index, { stock: Number(event.target.value) })} required /></label>
        <button type="button" className={styles.removeSize} onClick={() => onChange((current) => ({ ...current, variants: current.variants.filter((_, at) => at !== index) }))} aria-label={`Remove size ${variant.size || index + 1}`}>×</button>
      </div>)}</div> : <p className={styles.empty}>No sizes added yet.</p>}
    </section>
  </>;
}
