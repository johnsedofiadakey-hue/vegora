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
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Vouchers: the browser only keeps the code the customer typed. The server works out the discount again when the order is made.
  const [vouchersOn, setVouchersOn] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherChecking, setVoucherChecking] = useState(false);
  const [voucherError, setVoucherError] = useState("");
  const [voucher, setVoucher] = useState<{ code: string; percentOff: number; discountMinor: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(readBag()), 0);
    const controller = new AbortController();
    fetch("/api/checkout/zones", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { zones?: Zone[]; vouchers?: boolean };
        if (!Array.isArray(data.zones) || !data.zones.length) return;
        setZones(data.zones);
        setVouchersOn(data.vouchers === true);
        // Never pick an area for the customer when there is a choice: the delivery
        // price depends on it, and a quiet default could be paid for by mistake.
        if (data.zones.length === 1) setZoneId(data.zones[0].id);
        setAvailable(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);

  const zone = zones.find((entry) => entry.id === zoneId);
  const subtotal = items.reduce((sum, item) => sum + item.priceMinor * item.quantity, 0);
  const delivery = zone ? zone.feeMinor : null;
  const discount = voucher ? voucher.discountMinor : 0;
  const supportedBag = items.every((item) => item.currency === "GHS" && item.quantity <= 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!zone || !items.length || !supportedBag || submitting) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") || "").trim();
    const payload = {
      customer: { name: String(form.get("name") || ""), phone },
      delivery: { zoneId: zone.id, addressLine1: String(form.get("addressLine1") || "") },
      items: items.map(({ slug, variantId, quantity }) => ({ slug, variantId, quantity })),
      idempotencyKey: window.crypto.randomUUID(),
      ...(voucher ? { voucherCode: voucher.code } : {}),
    };
    try {
      const response = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store",
      });
      const result = await response.json() as CheckoutResult;
      if (!response.ok || !result.authorizationUrl) throw new Error(result.error || "We could not start your order. Please try again.");
      const destination = new URL(result.authorizationUrl);
      if (destination.protocol !== "https:" || !(destination.hostname === "paystack.com" || destination.hostname.endsWith(".paystack.com"))) {
        throw new Error("We could not check the payment page. Please contact VEGORA.");
      }
      if (result.reference && /^VG-[0-9a-f]{32}$/.test(result.reference)) {
        window.sessionStorage.setItem(`vegora-checkout-v1:${result.reference}`, JSON.stringify(items.map(({ key, quantity }) => ({ key, quantity }))));
        window.sessionStorage.setItem(`vegora-checkout-contact:${result.reference}`, phone);
      }
      window.location.assign(destination.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not start your order. Please try again.");
      setSubmitting(false);
    }
  }

  async function applyVoucher() {
    const code = voucherInput.trim();
    if (!code || voucherChecking) return;
    setVoucherChecking(true); setVoucherError("");
    try {
      const response = await fetch("/api/voucher/check", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ code, items: items.map(({ slug, variantId, quantity }) => ({ slug, variantId, quantity })) }),
      });
      const result = await response.json() as { percentOff?: number; discountMinor?: number; error?: string };
      if (!response.ok || !result.percentOff || !result.discountMinor) throw new Error(result.error || "This voucher cannot be used. Check the code and try again.");
      setVoucher({ code, percentOff: result.percentOff, discountMinor: result.discountMinor });
      setVoucherOpen(false); setVoucherInput("");
    } catch (cause) {
      setVoucherError(cause instanceof Error ? cause.message : "We could not check your voucher. Please try again.");
    } finally { setVoucherChecking(false); }
  }

  return <div className="checkout-page section-pad">
    <Link className="checkout-back" href="/cart"><ArrowLeft size={15} /> Back to cart</Link>
    <span className="eyebrow">VEGORA / CHECKOUT</span>
    <h1>Your details</h1>
    {loading ? <p className="checkout-state">Getting checkout ready…</p> : !available ? <div className="checkout-state"><h2>Checkout is not open yet.</h2><p>Please check again soon.</p><Link className="line-link" href="/cart">Back to your cart <ArrowUpRight size={16} /></Link></div> : !items.length ? <div className="checkout-state"><h2>Your cart is empty.</h2><Link className="line-link" href="/men">See the clothes <ArrowUpRight size={16} /></Link></div> :
      <div className="checkout-layout">
        <form id="checkout-form" className="checkout-form" onSubmit={submit}>
          <fieldset><legend>1. Who is this for?</legend>
            <label>Full name<input name="name" autoComplete="name" required maxLength={150} /></label>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="024 123 4567" required minLength={10} maxLength={30} /><small className="checkout-hint">We will call this number about your delivery. You also use it to track your order.</small></label>
          </fieldset>
          <fieldset><legend>2. Where should we deliver?</legend>
            <div className="checkout-zones" role="radiogroup" aria-label="Delivery area">{zones.map((entry) => <label key={entry.id} className="checkout-zone" data-selected={entry.id === zoneId}><input type="radio" name="zone" value={entry.id} checked={entry.id === zoneId} onChange={() => setZoneId(entry.id)} required /><span>Delivery in {entry.label}</span><strong>{formatMoney(entry.feeMinor)}</strong></label>)}</div>
            <label>Delivery address<textarea name="addressLine1" rows={3} required maxLength={300} placeholder="House number, street, area, and a place we can find easily" autoComplete="street-address" /></label>
          </fieldset>
          <p className="checkout-assurance">You pay safely with Paystack. We only accept your order after the payment works.</p>
          <p className="checkout-save-note"><b>Please read:</b> after you pay, you will see an order number. We do not send emails or texts, so take a screenshot of it. You need this number and your phone number to track your order on this website.</p>
          {error && <p className="checkout-error" role="alert">{error}</p>}
        </form>
        <aside className="checkout-summary"><span className="eyebrow">YOUR ORDER</span><h2>Summary</h2>
          <div className="checkout-lines">{items.map((item) => <div key={item.key}><span>{item.name}<small>Size {item.size} · Qty {item.quantity}</small></span><strong>{formatMoney(item.priceMinor * item.quantity)}</strong></div>)}</div>
          {vouchersOn && <div className="checkout-voucher">
            {voucher ? <p className="checkout-voucher-applied"><span>Voucher used · {voucher.percentOff}% off</span><button type="button" onClick={() => setVoucher(null)}>Remove</button></p>
              : voucherOpen ? <div className="checkout-voucher-form">
                <label htmlFor="voucher-code">Voucher number</label>
                <div><input id="voucher-code" value={voucherInput} onChange={(event) => setVoucherInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void applyVoucher(); } }} placeholder="XXXX-XXXX-XXXX" maxLength={40} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
                  <button type="button" onClick={() => void applyVoucher()} disabled={voucherChecking || !voucherInput.trim()}>{voucherChecking ? "Checking…" : "Use"}</button></div>
                {voucherError && <p className="checkout-error" role="alert">{voucherError}</p>}
              </div>
                : <button type="button" className="checkout-voucher-toggle" onClick={() => setVoucherOpen(true)}>Have a voucher?</button>}
          </div>}
          <div className="checkout-totals"><div><span>Clothes</span><strong>{formatMoney(subtotal)}</strong></div>{voucher && <div><span>Voucher</span><strong>−{formatMoney(discount)}</strong></div>}<div><span>Delivery</span><strong>{delivery === null ? "Choose an area" : formatMoney(delivery)}</strong></div><div className="checkout-grand-total"><span>{delivery === null ? "Total so far" : "Total"}</span><strong>{formatMoney(subtotal - discount + (delivery ?? 0))}</strong></div></div>
          <button form="checkout-form" type="submit" disabled={submitting || !supportedBag || !zone}>{submitting ? "Opening Paystack…" : "Pay with Paystack"} <ArrowUpRight size={16} /></button>
          {!supportedBag && <p className="checkout-error">Something in your cart needs fixing. Please go back to your cart.</p>}
          <p className="checkout-summary-note">We check the prices and stock again before you pay.</p>
        </aside>
      </div>}
  </div>;
}
