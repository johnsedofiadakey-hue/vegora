"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BagItem, readBag, writeBag } from "./bag-store";
import { formatMoney } from "./catalog-types";

export function BagPage() {
  const [items, setItems] = useState<BagItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setItems(readBag()); setLoaded(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/checkout/zones", { signal: controller.signal, cache: "no-store" })
      .then((response) => { if (response.ok) setCheckoutReady(true); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  function update(key: string, quantity: number) {
    const next = items.map((item) => item.key === key ? { ...item, quantity } : item).filter((item) => item.quantity > 0);
    setItems(next); writeBag(next);
  }
  const subtotal = items.reduce((total, item) => total + item.priceMinor * item.quantity, 0);
  const currency = items[0]?.currency || "GHS";

  return <div className="bag-page section-pad"><span className="eyebrow">VEGORA / YOUR SELECTION</span><h1>Shopping bag</h1>
    {!loaded ? <p>Loading your bag…</p> : !items.length ? <div className="bag-empty"><h2>Your bag is empty.</h2><p>Explore the collection and find a piece that feels like you.</p><div><Link className="line-link" href="/women">Shop women <ArrowUpRight size={16} /></Link><Link className="line-link" href="/men">Shop men <ArrowUpRight size={16} /></Link></div></div> :
      <div className="bag-layout"><div className="bag-items">{items.map((item) => <div className="bag-item" key={item.key}>
        <Link href={`/product/${encodeURIComponent(item.slug)}`} className="bag-item-image">{item.image ? <Image src={item.image} alt={item.imageAlt || item.name} width={300} height={380} unoptimized /> : <span>VEGORA</span>}</Link>
        <div className="bag-item-content"><div><Link href={`/product/${encodeURIComponent(item.slug)}`}><h2>{item.name}</h2></Link><p>Size {item.size}</p><p>{formatMoney(item.priceMinor, item.currency)}</p></div><div className="bag-quantity"><button type="button" aria-label={`Remove one ${item.name}`} onClick={() => update(item.key, item.quantity - 1)}><Minus size={14} /></button><span>{item.quantity}</span><button type="button" aria-label={`Add one ${item.name}`} onClick={() => update(item.key, Math.min(10, item.quantity + 1))} disabled={item.quantity >= 10}><Plus size={14} /></button></div></div>
        <button className="bag-remove" type="button" aria-label={`Remove ${item.name}`} onClick={() => update(item.key, 0)}><X size={18} /></button>
      </div>)}</div><aside className="bag-summary"><h2>Summary</h2><div><span>Subtotal</span><strong>{formatMoney(subtotal, currency)}</strong></div><p>Delivery is calculated from your destination at checkout.</p>{checkoutReady ? <Link className="bag-checkout-link" href="/checkout">Proceed to checkout <ArrowUpRight size={16} /></Link> : <button type="button" disabled>Checkout is being prepared</button>}<p className="bag-note">{checkoutReady ? "Your order total will be confirmed before payment." : "Online checkout will open when payment and delivery are configured."}</p><Link href="/new-in" className="line-link">Continue exploring <ArrowUpRight size={16} /></Link></aside></div>}
  </div>;
}
