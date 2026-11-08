"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import type { Product, ProductInput, ProductStatus } from "@/lib/catalog";
import { adminAuth } from "@/lib/admin-client";
import { autoSku } from "./product-assets-editor";
import { ContentEditor } from "./content-editor";
import { SignupsPanel } from "./signups-panel";
import { VouchersPanel } from "./vouchers-panel";
import { StudioNav, type StudioView } from "./studio-nav";
import { ProductEditor, ProductGrid } from "./products-view";
import { OrdersView, needsDelivery, type AdminOrder } from "./orders-view";
import type { FulfillmentEvent, FulfillmentInput } from "@/lib/fulfillment";
import styles from "./admin.module.css";
import studio from "./studio.module.css";

const emptyProduct: ProductInput = {
  slug: "", name: "", description: "", audience: "men", category: "",
  priceMinor: null, currency: "GHS", images: [], variants: [], status: "draft", featured: false, tags: ["new_arrival"],
};

export default function AdminPage() {
  const auth = useMemo(() => adminAuth(), []);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [view, setView] = useState<StudioView>("products");
  const [menuOpen, setMenuOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  // Mounted on first visit and then kept, so unsaved content edits survive switching tabs.
  const [contentVisited, setContentVisited] = useState(false);
  const [signupsVisited, setSignupsVisited] = useState(false);
  const [vouchersVisited, setVouchersVisited] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orderEvents, setOrderEvents] = useState<FulfillmentEvent[]>([]);
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
      if (result.truncated) setMessage("Showing the latest 200 orders. Older orders are not listed here yet.");
      const reference = selectedOrder && result.orders.some((order: AdminOrder) => order.reference === selectedOrder)
        ? selectedOrder : result.orders[0]?.reference;
      setSelectedOrder(reference ?? null);
      if (reference) await loadOrderEvents(reference);
      else setOrderEvents([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load orders");
    }
  }

  async function loadOrderEvents(reference: string) {
    const result = await adminFetch(`/api/admin/orders/${encodeURIComponent(reference)}`);
    setOrderEvents(result.events ?? []);
  }

  async function selectOrder(reference: string) {
    setSelectedOrder(reference);
    setOrderDetailOpen(true);
    setOrderEvents([]);
    try { await loadOrderEvents(reference); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load order updates"); }
  }

  async function saveFulfillment(reference: string, input: FulfillmentInput) {
    setBusy(true); setMessage("");
    try {
      const result = await adminFetch(`/api/admin/orders/${encodeURIComponent(reference)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      setOrders((current) => current.map((order) => order.reference === reference ? result.order : order));
      setOrderEvents(result.events ?? []);
      setMessage("Delivery update saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save delivery update");
    } finally { setBusy(false); }
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

  async function saveProduct(status: ProductStatus) {
    setBusy(true); setMessage("");
    // Sizes left without a stock code get one made from the web address and size.
    const product: ProductInput = { ...editing, status,
      variants: editing.variants.map((variant) => ({ ...variant, sku: variant.sku.trim() || autoSku(editing.slug, variant.size) })) };
    try {
      const path = originalSlug ? `/api/admin/products/${originalSlug}` : "/api/admin/products";
      await adminFetch(path, {
        method: originalSlug ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      setEditing(product);
      setOriginalSlug(product.slug);
      await loadProducts();
      setMessage(status === "published" && editing.status !== "published" ? "Published. It is now live in the shop."
        : status === "draft" && editing.status === "published" ? "Hidden from the shop. It is now a draft."
          : status === "draft" && editing.status === "archived" ? "Restored as a draft." : "Changes saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save product"); }
    finally { setBusy(false); }
  }

  async function archive() {
    if (!originalSlug) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/products/${originalSlug}`, { method: "DELETE" });
      setEditing({ ...emptyProduct }); setOriginalSlug(null); setProductOpen(false);
      await loadProducts(); setMessage("Product archived.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to archive product"); }
    finally { setBusy(false); }
  }

  async function importPreviewProducts() {
    setBusy(true); setMessage("");
    try {
      const result: { created: string[]; skipped: string[] } = await adminFetch("/api/admin/import-preview", { method: "POST" });
      await loadProducts();
      setMessage(`Imported ${result.created.length} draft ${result.created.length === 1 ? "product" : "products"}. ${result.skipped.length} existing ${result.skipped.length === 1 ? "product was" : "products were"} left unchanged. Review names, prices, sizes and stock before publishing.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import preview products");
    } finally { setBusy(false); }
  }

  async function uploadImages(files: File[]) {
    const available = 12 - editing.images.length;
    if (files.length > available) {
      setMessage(`Choose no more than ${available} additional ${available === 1 ? "image" : "images"}.`);
      return;
    }
    const invalid = files.find((file) => file.size === 0 || file.size > 8 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type));
    if (invalid) {
      setMessage(`${invalid.name} must be a JPEG, PNG, WebP or AVIF under 8 MB.`);
      return;
    }
    setBusy(true); setMessage("");
    const uploaded: { url: string; alt: string }[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setMessage(`Uploading image ${index + 1} of ${files.length}…`);
        const data = new FormData(); data.append("file", file);
        const result = await adminFetch("/api/admin/upload", { method: "POST", body: data });
        uploaded.push({ url: result.url, alt: editing.name || "Product image" });
      }
      setMessage(`${uploaded.length} ${uploaded.length === 1 ? "image" : "images"} uploaded. Save the product to add them to the catalog.`);
    } catch (error) {
      setMessage(`${uploaded.length} of ${files.length} images uploaded. ${error instanceof Error ? error.message : "Image upload failed"}`);
    } finally {
      if (uploaded.length) setEditing((current) => ({ ...current, images: [...current.images, ...uploaded] }));
      setBusy(false);
    }
  }

  function selectProduct(product: Product) {
    if (busy) return;
    setOriginalSlug(product.slug);
    setEditing({
      slug: product.slug, name: product.name, description: product.description,
      audience: product.audience, category: product.category,
      priceMinor: product.priceMinor, currency: product.currency,
      images: product.images, variants: product.variants,
      status: product.status, featured: product.featured,
      tags: product.tags ?? [],
    });
    setProductOpen(true);
    setMessage(""); window.scrollTo({ top: 0 });
  }

  function newProduct() {
    if (busy) return;
    setEditing({ ...emptyProduct }); setOriginalSlug(null); setProductOpen(true);
    setMessage(""); window.scrollTo({ top: 0 });
  }

  const selectView = useCallback((next: StudioView) => {
    if (next === "content") setContentVisited(true);
    if (next === "signups") setSignupsVisited(true);
    if (next === "vouchers") setVouchersVisited(true);
    setView(next); setMessage(""); window.scrollTo({ top: 0 });
  }, []);

  if (!ready) return <main className={styles.shell}><p className={studio.loading}>Loading studio…</p></main>;
  if (!auth) return <main className={styles.shell}><div className={styles.login}><div className={styles.wordmark}>VEGORA</div><h1>Admin setup needed</h1><p>Firebase client configuration is missing. See the project setup notes before signing in.</p><Link href="/">Return to store</Link></div></main>;
  if (!user) return <main className={styles.shell}><form className={styles.login} onSubmit={signIn}><div className={styles.wordmark}>VEGORA</div><p className={styles.eyebrow}>PRIVATE STUDIO</p><h1>Sign in</h1><label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label><button disabled={busy}>Enter admin</button>{message && <p role="alert" className={styles.message}>{message}</p>}<Link href="/">Return to store</Link></form></main>;

  return <main className={`${styles.shell} ${studio.app}`}>
    <StudioNav view={view} onSelect={selectView} open={menuOpen} onOpenChange={setMenuOpen}
      ordersToHandle={orders.filter(needsDelivery).length} email={user.email ?? ""} onSignOut={() => void signOut(auth)} />
    <div className={studio.main}>
      {view === "products" && (productOpen
        ? <ProductEditor key={originalSlug ?? "new"} editing={editing} setEditing={setEditing} isNew={!originalSlug} message={message} busy={busy}
          onSave={saveProduct} onArchive={archive} onUpload={uploadImages} onBack={() => { setProductOpen(false); setMessage(""); }} />
        : <>{message && <div className={studio.pageMessage}><p role="status" className={styles.message}>{message}</p></div>}
          <ProductGrid products={products} busy={busy} onSelect={selectProduct} onNew={newProduct} onImport={() => void importPreviewProducts()} /></>)}
      {view === "orders" && <OrdersView orders={orders} products={products} selected={selectedOrder} detailOpen={orderDetailOpen} events={orderEvents}
        message={message} busy={busy} onSelect={(reference) => void selectOrder(reference)} onBack={() => setOrderDetailOpen(false)}
        onRefresh={() => void loadOrders()} onSaveFulfillment={saveFulfillment} />}
      {contentVisited && <div hidden={view !== "content"}><ContentEditor adminFetch={adminFetch} /></div>}
      {signupsVisited && <div hidden={view !== "signups"}><SignupsPanel adminFetch={adminFetch} /></div>}
      {vouchersVisited && <div hidden={view !== "vouchers"}><VouchersPanel adminFetch={adminFetch} /></div>}
    </div>
  </main>;
}
