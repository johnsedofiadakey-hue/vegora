"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import type { Product, ProductImage, ProductInput, ProductVariant, ProductStatus, Audience } from "@/lib/catalog";
import { formatGhs } from "@/lib/catalog";
import { adminAuth } from "@/lib/admin-client";
import styles from "./admin.module.css";

const emptyProduct: ProductInput = {
  slug: "", name: "", description: "", audience: "women", category: "",
  priceMinor: null, currency: "GHS", images: [], variants: [], status: "draft", featured: false,
};

interface AdminOrder {
  reference: string;
  status: string;
  email: string;
  customer: { name: string; phone: string };
  delivery: { zoneLabel: string; addressLine1: string; addressLine2: string; city: string; region: string; notes: string };
  lines: { name: string; size: string; sku: string; quantity: number; lineTotalMinor: number }[];
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  createdAt: string;
  paidAt: string | null;
}

export default function AdminPage() {
  const auth = useMemo(() => adminAuth(), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [view, setView] = useState<"products" | "orders">("products");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductInput>({ ...emptyProduct });
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => { setUser(nextUser); setReady(true); });
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    void loadProducts();
    void loadOrders();
    // The authenticated user object is stable enough to trigger initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function adminFetch(path: string, init?: RequestInit) {
    if (!user) throw new Error("Sign in first");
    const token = await user.getIdToken();
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Request failed");
    return result;
  }

  async function loadProducts() {
    try {
      const result = await adminFetch("/api/admin/products");
      setProducts(result.products);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load products");
    }
  }

  async function loadOrders() {
    try {
      const result = await adminFetch("/api/admin/orders");
      setOrders(result.orders);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load orders");
    }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    setBusy(true); setMessage("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setPassword("");
    } catch {
      setMessage("Sign-in failed. Check your credentials and admin access.");
    } finally { setBusy(false); }
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const path = originalSlug ? `/api/admin/products/${originalSlug}` : "/api/admin/products";
      await adminFetch(path, {
        method: originalSlug ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      setMessage("Product saved.");
      setOriginalSlug(editing.slug);
      await loadProducts();
      setMessage("Product saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save product"); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (!originalSlug || !window.confirm(`Archive ${editing.name}? It will disappear from the storefront.`)) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/products/${originalSlug}`, { method: "DELETE" });
      setEditing({ ...emptyProduct }); setOriginalSlug(null);
      await loadProducts(); setMessage("Product archived.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to archive product"); }
    finally { setBusy(false); }
  }

  async function uploadImage(file: File) {
    setBusy(true); setMessage("");
    try {
      const data = new FormData(); data.append("file", file);
      const result = await adminFetch("/api/admin/upload", { method: "POST", body: data });
      setEditing((current) => ({ ...current, images: [...current.images, { url: result.url, alt: current.name || "Product image" }] }));
      setMessage("Image uploaded. Save the product to keep it in the catalog.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Image upload failed"); }
    finally { setBusy(false); }
  }

  function selectProduct(product: Product) {
    setOriginalSlug(product.slug);
    setEditing({
      slug: product.slug, name: product.name, description: product.description,
      audience: product.audience, category: product.category,
      priceMinor: product.priceMinor, currency: product.currency,
      images: product.images, variants: product.variants,
      status: product.status, featured: product.featured,
    });
    setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateImage(index: number, patch: Partial<ProductImage>) {
    setEditing((current) => ({ ...current, images: current.images.map((image, at) => at === index ? { ...image, ...patch } : image) }));
  }

  function updateVariant(index: number, patch: Partial<ProductVariant>) {
    setEditing((current) => ({ ...current, variants: current.variants.map((variant, at) => at === index ? { ...variant, ...patch } : variant) }));
  }

  if (!ready) return <main className={styles.shell}>Loading admin…</main>;
  if (!auth) return <main className={styles.shell}><div className={styles.login}><div className={styles.wordmark}>VEGORA</div><h1>Admin setup needed</h1><p>Firebase client configuration is missing. See the project setup notes before signing in.</p><Link href="/">Return to store</Link></div></main>;
  if (!user) return <main className={styles.shell}><form className={styles.login} onSubmit={signIn}><div className={styles.wordmark}>VEGORA</div><p className={styles.eyebrow}>PRIVATE STUDIO</p><h1>Sign in</h1><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label><button disabled={busy}>Enter admin</button>{message && <p role="alert" className={styles.message}>{message}</p>}<Link href="/">Return to store</Link></form></main>;

  return <main className={styles.shell}>
    <header className={styles.header}><div><Link href="/" className={styles.wordmark}>VEGORA</Link><span>STUDIO ADMIN</span></div><button className={styles.textButton} onClick={() => signOut(auth)}>Sign out</button></header>
    <nav className={styles.tabs} aria-label="Admin sections"><button className={view === "products" ? styles.activeTab : ""} onClick={() => setView("products")}>Products</button><button className={view === "orders" ? styles.activeTab : ""} onClick={() => setView("orders")}>Orders</button></nav>
    {view === "orders" ? <div className={styles.ordersLayout}>
      <aside className={styles.sidebar}><p className={styles.eyebrow}>ORDER DESK</p><h2>Orders <span>{orders.length}</span></h2><button className={styles.newButton} onClick={loadOrders}>Refresh orders</button><div className={styles.productList}>{orders.map((order) => <button key={order.reference} className={selectedOrder === order.reference ? styles.selected : ""} onClick={() => setSelectedOrder(order.reference)}><strong>{order.customer.name}</strong><small>{order.status.replaceAll("_", " ")} · {formatGhs(order.totalMinor)}</small></button>)}</div><p className={styles.sideNote}>Paid status requires server-side Paystack verification. Fulfillment actions are held until operations are agreed and tested.</p></aside>
      <section className={styles.editor}>{message && <p role="status" className={styles.message}>{message}</p>}{(() => { const order = orders.find((item) => item.reference === selectedOrder) ?? orders[0]; return order ? <><p className={styles.eyebrow}>ORDER {order.reference}</p><h1 className={styles.orderTitle}>{order.customer.name}</h1><p className={styles.orderStatus}>{order.status.replaceAll("_", " ")}</p><p className={styles.orderMeta}>Placed {new Date(order.createdAt).toLocaleString("en-GH")}{order.paidAt ? ` · Paid ${new Date(order.paidAt).toLocaleString("en-GH")}` : ""}</p><div className={styles.orderBlock}><h2>Items</h2>{order.lines.map((line) => <div className={styles.orderRow} key={`${line.sku}-${line.size}`}><span>{line.name} · {line.size} × {line.quantity}<small>{line.sku}</small></span><strong>{formatGhs(line.lineTotalMinor)}</strong></div>)}<div className={styles.orderRow}><span>Subtotal</span><strong>{formatGhs(order.subtotalMinor)}</strong></div><div className={styles.orderRow}><span>Delivery</span><strong>{formatGhs(order.deliveryFeeMinor)}</strong></div><div className={styles.orderRow}><span>Total</span><strong>{formatGhs(order.totalMinor)}</strong></div></div><div className={styles.orderBlock}><h2>Customer & delivery</h2><p>{order.email}<br />{order.customer.phone}</p><p>{order.delivery.addressLine1}{order.delivery.addressLine2 ? `, ${order.delivery.addressLine2}` : ""}<br />{order.delivery.city}, {order.delivery.region}<br />{order.delivery.zoneLabel}</p>{order.delivery.notes && <p>Note: {order.delivery.notes}</p>}</div></> : <><p className={styles.eyebrow}>ORDER DESK</p><h1 className={styles.orderTitle}>No orders yet</h1><p>Orders will appear after test checkout is configured and used.</p></>; })()}</section>
    </div> :
    <div className={styles.layout}>
      <aside className={styles.sidebar}><p className={styles.eyebrow}>CATALOG</p><h2>Products <span>{products.length}</span></h2><button className={styles.newButton} onClick={() => { setEditing({ ...emptyProduct }); setOriginalSlug(null); setMessage(""); }}>+ New product</button><div className={styles.productList}>{products.map((product) => <button key={product.id} className={product.slug === originalSlug ? styles.selected : ""} onClick={() => selectProduct(product)}><strong>{product.name}</strong><small>{product.status} · {formatGhs(product.priceMinor)}</small></button>)}</div><p className={styles.sideNote}>Orders and payment actions appear after Paystack checkout and reconciliation are verified.</p></aside>
      <section className={styles.editor}><div className={styles.editorTop}><div><p className={styles.eyebrow}>PRODUCT DETAILS</p><h1>{originalSlug ? "Edit product" : "New product"}</h1></div><span className={styles.status}>{editing.status}</span></div>
        {message && <p role="status" className={styles.message}>{message}</p>}
        <form onSubmit={saveProduct}>
          <div className={styles.grid}><label>Name<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={140} required /></label><label>Slug<input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} disabled={!!originalSlug} placeholder="linen-wide-leg-trouser" required /></label></div>
          <label>Description<textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={5} maxLength={5000} /></label>
          <div className={styles.grid}><label>Collection<select value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value as Audience })}><option value="women">Women</option><option value="men">Men</option><option value="unisex">Unisex</option></select></label><label>Category<input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Tailoring" required /></label></div>
          <div className={styles.grid}><label>Price (GHS)<input type="number" min="0" step="0.01" value={editing.priceMinor === null ? "" : (editing.priceMinor / 100).toFixed(2)} onChange={(e) => setEditing({ ...editing, priceMinor: e.target.value === "" ? null : Math.round(Number(e.target.value) * 100) })} placeholder="0.00" /></label><label>Status<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProductStatus })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
          <label className={styles.checkbox}><input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> Feature on storefront</label>
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>VISUALS</p><h2>Product images</h2></div><label className={styles.uploadButton}>+ Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadImage(file); e.target.value = ""; }} /></label></div>
          <div className={styles.imageGrid}>{editing.images.map((image, index) => <div key={image.url} className={styles.imageCard}><Image src={image.url} alt={image.alt} width={300} height={400} unoptimized /><input aria-label={`Image ${index + 1} description`} value={image.alt} onChange={(e) => updateImage(index, { alt: e.target.value })} /><button type="button" onClick={() => setEditing({ ...editing, images: editing.images.filter((_, at) => at !== index) })}>Remove</button></div>)}</div>
          {editing.images.length === 0 && <p className={styles.hint}>Upload original product photography before publishing.</p>}
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>INVENTORY</p><h2>Sizes & stock</h2></div><button type="button" className={styles.uploadButton} onClick={() => setEditing({ ...editing, variants: [...editing.variants, { id: crypto.randomUUID(), sku: "", size: "", stock: 0 }] })}>+ Add size</button></div>
          {editing.variants.map((variant, index) => <div key={variant.id} className={styles.variantRow}><label>Size<input value={variant.size} onChange={(e) => updateVariant(index, { size: e.target.value })} placeholder="M" /></label><label>SKU<input value={variant.sku} onChange={(e) => updateVariant(index, { sku: e.target.value.toUpperCase() })} placeholder="VG-001-M" /></label><label>Stock<input type="number" min="0" step="1" value={variant.stock} onChange={(e) => updateVariant(index, { stock: Number(e.target.value) })} /></label><button type="button" onClick={() => setEditing({ ...editing, variants: editing.variants.filter((_, at) => at !== index) })} aria-label={`Remove size ${variant.size || index + 1}`}>×</button></div>)}
          <div className={styles.actions}><button type="submit" disabled={busy}>{busy ? "Working…" : "Save product"}</button>{originalSlug && <button type="button" className={styles.archive} onClick={archive} disabled={busy}>Archive</button>}</div>
        </form>
      </section>
    </div>}
  </main>;
}
