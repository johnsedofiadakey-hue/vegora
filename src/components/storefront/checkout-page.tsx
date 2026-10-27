"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { type BagItem, readBag } from "./bag-store";
import { formatMoney } from "./catalog-types";

type Zone = { id: string; label: string; region: string; cities: string[] | null; feeMinor: number };
type CheckoutResult = { authorizationUrl?: string; reference?: string; error?: string };

export function CheckoutPage() {
  const [items, setItems] = useState<BagItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(readBag()), 0);
    const controller = new AbortController();
    fetch("/api/checkout/zones", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { zones?: Zone[] };
        if (!Array.isArray(data.zones) || !data.zones.length) return;
        setZones(data.zones);
        setZoneId(data.zones[0].id);
        setCity(data.zones[0].cities?.[0] || "");
        setAvailable(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);

  const zone = zones.find((entry) => entry.id === zoneId);
  const subtotal = items.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0);
  const delivery = zone?.feeMinor ?? 0;
  const supportedBag = items.every((item) => item.currency === "GHS" && item.quantity <= 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!zone || !items.length || !supportedBag || submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      email: String(form.get("email") || ""),
      customer: { name: String(form.get("name") || ""), phone: String(form.get("phone") || "") },
      delivery: {
        zoneId: zone.id,
        addressLine1: String(form.get("addressLine1") || ""),
        addressLine2: String(form.get("addressLine2") || ""),
        city: String(form.get("city") || ""),
        region: zone.region,
        notes: String(form.get("notes") || ""),
      },
      items: items.map(({ slug, variantId, quantity }) => ({ slug, variantId, quantity })),
      idempotencyKey: window.crypto.randomUUID(),
    };
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store",
      });
      const result = await response.json() as CheckoutResult;
      if (!response.ok || !result.authorizationUrl) throw new Error(result.error || "Checkout could not begin. Please try again.");
      const destination = new URL(result.authorizationUrl);
      if (destination.protocol !== "https:" || !(destination.hostname === "paystack.com" || destination.hostname.endsWith(".paystack.com"))) {
        throw new Error("The payment destination could not be verified. Please contact VEGORA.");
      }
      if (result.reference && /^VG-[0-9a-f]{32}$/.test(result.reference)) {
        window.sessionStorage.setItem(`vegora-checkout-v1:${result.reference}`, JSON.stringify(items.map(({ key, quantity }) => ({ key, quantity }))));
      }
      window.location.assign(destination.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not begin. Please try again.");
      setSubmitting(false);
    }
  }

  return <div className="checkout-page section-pad">
    <Link className="checkout-back" href="/bag"><ArrowLeft size={15} /> Back to bag</Link>
    <span className="eyebrow">VEGORA / PRIVATE CHECKOUT</span>
    <h1>Complete your order</h1>
    {loading ? <p className="checkout-state">Preparing checkout…</p> : !available ? <div className="checkout-state"><h2>Checkout is being prepared.</h2><p>We will open online orders once payment and delivery are configured.</p><Link className="line-link" href="/bag">Return to your bag <ArrowUpRight size={16} /></Link></div> : !items.length ? <div className="checkout-state"><h2>Your bag is empty.</h2><Link className="line-link" href="/women">Explore the collection <ArrowUpRight size={16} /></Link></div> :
      <div className="checkout-layout">
        <form id="checkout-form" className="checkout-form" onSubmit={submit}>
          <fieldset><legend>01 / Contact</legend>
            <label>Full name<input name="name" autoComplete="name" required maxLength={150} /></label>
            <div className="checkout-fields"><label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" inputMode="tel" required minLength={8} maxLength={30} /></label></div>
          </fieldset>
          <fieldset><legend>02 / Delivery in Ghana</legend>
            <label>Delivery area<select value={zoneId} onChange={(event) => { const next = zones.find((entry) => entry.id === event.target.value); setZoneId(event.target.value); setCity(next?.cities?.[0] || ""); }} required>{zones.map((entry) => <option key={entry.id} value={entry.id}>{entry.label} · {formatMoney(entry.feeMinor)}</option>)}</select></label>
            <label>Address line 1<input name="addressLine1" autoComplete="address-line1" required maxLength={200} /></label>
            <label>Address line 2 <span>(optional)</span><input name="addressLine2" autoComplete="address-line2" maxLength={200} /></label>
            <div className="checkout-fields"><label>City{zone?.cities?.length ? <select name="city" value={city} onChange={(event) => setCity(event.target.value)} required>{zone.cities.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select> : <input name="city" value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" required maxLength={100} />}</label><label>Region<input value={zone?.region || ""} readOnly aria-label="Region" /></label></div>
            <label>Delivery notes <span>(optional)</span><textarea name="notes" rows={3} maxLength={500} placeholder="Landmark or delivery instructions" /></label>
          </fieldset>
          <p className="checkout-assurance">Your payment is handled securely by Paystack. We confirm an order only after payment verification.</p>
          {error && <p className="checkout-error" role="alert">{error}</p>}
        </form>
        <aside className="checkout-summary"><span className="eyebrow">YOUR SELECTION</span><h2>Order summary</h2>
          <div className="checkout-lines">{items.map((item) => <div key={item.key}><span>{item.name}<small>Size {item.size} · Qty {item.quantity}</small></span><strong>{formatMoney(item.priceMinor * item.quantity)}</strong></div>)}</div>
          <div className="checkout-totals"><div><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div><div><span>Delivery</span><strong>{formatMoney(delivery)}</strong></div><div className="checkout-grand-total"><span>Total</span><strong>{formatMoney(subtotal + delivery)}</strong></div></div>
          <button form="checkout-form" type="submit" disabled={submitting || !supportedBag}>{submitting ? "Connecting to Paystack…" : "Continue to secure payment"} <ArrowUpRight size={16} /></button>
          {!supportedBag && <p className="checkout-error">Your bag needs updating. Please return to your bag before checkout.</p>}
          <p className="checkout-summary-note">Prices and stock are checked again before payment begins.</p>
        </aside>
      </div>}
  </div>;
}
