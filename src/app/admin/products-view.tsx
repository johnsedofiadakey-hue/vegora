"use client";

import Image from "next/image";
import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { ArrowLeft, Check, Plus, X } from "lucide-react";
import type { Audience, Product, ProductInput, ProductStatus, ProductTag } from "@/lib/catalog";
import { formatGhs } from "@/lib/catalog";
import { ProductAssetsEditor } from "./product-assets-editor";
import admin from "./admin.module.css";
import styles from "./studio.module.css";

type Filter = "all" | ProductStatus;

const statusLabel: Record<ProductStatus, string> = { published: "Live", draft: "Draft", archived: "Archived" };

export function stockOf(product: Pick<ProductInput, "variants">): number {
  return product.variants.reduce((sum, variant) => sum + (Number.isFinite(variant.stock) ? variant.stock : 0), 0);
}

function stockText(product: Pick<ProductInput, "variants">): string {
  if (product.variants.length === 0) return "No sizes yet";
  const stock = stockOf(product);
  return stock === 0 ? "Out of stock" : `${stock} in stock`;
}

/** What still stops a product from going live, in the order the admin should fix it. */
export function publishChecklist(product: ProductInput): { label: string; done: boolean; required: boolean }[] {
  return [
    { label: "A photo", done: product.images.length > 0, required: true },
    { label: "A price", done: product.priceMinor !== null && product.priceMinor > 0, required: true },
    { label: "At least one size", done: product.variants.length > 0, required: true },
    { label: "Stock entered", done: stockOf(product) > 0, required: false },
  ];
}

export function ProductGrid({ products, busy, onSelect, onNew, onImport }: {
  products: Product[];
  busy: boolean;
  onSelect: (product: Product) => void;
  onNew: () => void;
  onImport: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = products.filter((product) => filter === "all" ? product.status !== "archived" : product.status === filter);
  const count = (status: ProductStatus) => products.filter((product) => product.status === status).length;
  const filters: [Filter, string, number][] = [
    ["all", "All", products.length - count("archived")], ["published", "Live", count("published")],
    ["draft", "Drafts", count("draft")], ["archived", "Archived", count("archived")],
  ];

  return <section className={styles.page} aria-labelledby="products-title">
    <div className={styles.pageHead}>
      <div><p className={styles.kicker}>Catalog</p><h1 id="products-title">Products</h1></div>
      <button type="button" className={styles.primary} disabled={busy} onClick={onNew}><Plus size={16} aria-hidden="true" />New product</button>
    </div>
    <p className={styles.lead}>Tap a product to set its price, sizes and stock, then publish it. Drafts are hidden from customers.</p>
    <div className={styles.filters} role="group" aria-label="Show products">
      {filters.map(([id, label, total]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} <span>{total}</span></button>)}
    </div>
    {visible.length > 0 ? <ul className={styles.productGrid}>
      {visible.map((product) => <li key={product.id}>
        <button type="button" disabled={busy} onClick={() => onSelect(product)}>
          <span className={styles.cardImage}>
            {product.images[0] ? <Image src={product.images[0].url} alt="" width={360} height={480} unoptimized /> : <span>No photo</span>}
            <em className={styles[`pill_${product.status}`]}>{statusLabel[product.status]}</em>
          </span>
          <strong>{product.name || "Untitled product"}</strong>
          <span className={styles.cardMeta}><span>{formatGhs(product.priceMinor)}</span><span className={product.variants.length > 0 && stockOf(product) === 0 ? styles.warn : ""}>{stockText(product)}</span></span>
        </button>
      </li>)}
    </ul> : <div className={styles.empty}>
      <h2>{products.length === 0 ? "No products yet." : "Nothing here."}</h2>
      <p>{products.length === 0 ? "Add your first product, or bring in the seven supplied T-shirt styles as drafts." : "Choose another filter above."}</p>
    </div>}
    <div className={styles.quietActions}>
      <button type="button" disabled={busy} onClick={onImport}>Import the seven supplied T-shirt styles</button>
      <small>Adds any that are missing as drafts. Products already here are never changed.</small>
    </div>
  </section>;
}

export function ProductEditor({ editing, setEditing, isNew, message, busy, onSave, onArchive, onUpload, onBack }: {
  editing: ProductInput;
  setEditing: Dispatch<SetStateAction<ProductInput>>;
  isNew: boolean;
  message: string;
  busy: boolean;
  onSave: (status: ProductStatus) => Promise<void>;
  onArchive: () => Promise<void>;
  onUpload: (files: File[]) => Promise<void>;
  onBack: () => void;
}) {
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const checklist = publishChecklist(editing);
  const ready = checklist.every((item) => !item.required || item.done);
  const live = editing.status === "published";

  function setName(name: string) {
    setEditing((current) => ({ ...current, name,
      slug: slugTouched ? current.slug : name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(editing.status);
  }

  return <section className={`${styles.page} ${admin.editor}`} aria-labelledby="product-title">
    <button type="button" className={styles.back} onClick={onBack} disabled={busy}><ArrowLeft size={16} aria-hidden="true" />All products</button>
    <div className={styles.pageHead}>
      <div><p className={styles.kicker}>{isNew ? "New product" : "Edit product"}</p><h1 id="product-title">{editing.name || "Untitled product"}</h1></div>
      <em className={styles[`pill_${editing.status}`]}>{statusLabel[editing.status]}</em>
    </div>
    {message && <p role="status" className={admin.message}>{message}</p>}

    <div className={styles.publishBox}>
      <div>
        <strong>{live ? "This product is live in the shop." : ready ? "Ready to publish." : "Before it can go live:"}</strong>
        <ul>{checklist.map((item) => <li key={item.label} className={item.done ? styles.done : item.required ? "" : styles.optional}>
          {item.done ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}{item.label}{!item.required && !item.done ? " (shows as sold out)" : ""}
        </li>)}</ul>
      </div>
      <div className={styles.publishActions}>
        {live
          ? <button type="button" className={styles.secondary} disabled={busy} onClick={() => void onSave("draft")}>Hide from shop</button>
          : <button type="button" className={styles.primary} disabled={busy || !ready} onClick={() => void onSave("published")}>Save and publish</button>}
      </div>
    </div>

    <form onSubmit={submit}>
      <div className={admin.grid}>
        <label>Name<input value={editing.name} onChange={(e) => setName(e.target.value)} maxLength={140} required /></label>
        <label>Price (GH₵)<input type="number" inputMode="decimal" min="0" step="0.01" value={editing.priceMinor === null ? "" : (editing.priceMinor / 100).toFixed(2)} onChange={(e) => setEditing({ ...editing, priceMinor: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} placeholder="0.00" /></label>
      </div>

      <ProductAssetsEditor product={editing} onChange={setEditing} onUpload={onUpload} busy={busy} part="sizes" />
      <ProductAssetsEditor product={editing} onChange={setEditing} onUpload={onUpload} busy={busy} part="images" />

      <details className={styles.more} open={isNew}>
        <summary>Description, collection and tags</summary>
        <div>
          <label>Description<textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={5} maxLength={5000} /></label>
          <div className={admin.grid}>
            <label>Collection<select value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value as Audience })}><option value="women">Women</option><option value="men">Men</option><option value="unisex">Unisex</option></select></label>
            <label>Category<input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="T-shirts" required /></label>
          </div>
          <div className={admin.tagsField} role="group" aria-label="Product tags"><span>Tags</span><div>
            {([["new_arrival", "New arrival"], ["best_seller", "Best seller"]] as [ProductTag, string][]).map(([tag, label]) => <label key={tag} className={admin.checkbox}><input type="checkbox" checked={editing.tags.includes(tag)} onChange={(e) => setEditing({ ...editing, tags: e.target.checked ? [...editing.tags, tag] : editing.tags.filter((item) => item !== tag) })} /> {label}</label>)}
            <label className={admin.checkbox}><input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> Feature on storefront</label>
          </div><small>New arrivals appear on the home page and in New In.</small></div>
          <label>Web address<input value={editing.slug} onChange={(e) => { setSlugTouched(true); setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }); }} disabled={!isNew} placeholder="made-from-the-name" required />
            <span className={styles.fieldNote}>{isNew ? "Made from the name. It cannot be changed after the first save." : `shopvegora.com/product/${editing.slug}`}</span></label>
        </div>
      </details>

      <div className={styles.saveBar}>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        {!isNew && editing.status !== "archived" && (confirmArchive
          ? <span className={styles.confirm} role="alertdialog" aria-label="Archive product">Archive this product? It disappears from the shop.
            <button type="button" className={styles.danger} disabled={busy} onClick={() => { setConfirmArchive(false); void onArchive(); }}>Archive</button>
            <button type="button" className={styles.secondary} onClick={() => setConfirmArchive(false)}>Keep</button></span>
          : <button type="button" className={styles.linkButton} disabled={busy} onClick={() => setConfirmArchive(true)}>Archive product</button>)}
        {editing.status === "archived" && <button type="button" className={styles.secondary} disabled={busy} onClick={() => void onSave("draft")}>Restore as draft</button>}
      </div>
    </form>
  </section>;
}
