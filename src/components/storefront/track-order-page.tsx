"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { shortOrderCode } from "@/lib/fulfillment";

type TrackingResult = {
  orderId: string;
  paymentStatus: string;
  placedAt: string;
  paidAt: string | null;
  fulfillmentStatus: "unfulfilled" | "preparing" | "dispatched" | "delivered";
  provider: string | null;
  trackingReference: string | null;
  updates: { status: string; at: string }[];
};

const statusCopy: Record<TrackingResult["fulfillmentStatus"], string> = {
  unfulfilled: "Order confirmed",
  preparing: "Preparing your order",
  dispatched: "On its way",
  delivered: "Delivered",
};

function unpaidHeading(paymentStatus: string) {
  if (paymentStatus === "review_required") return "Order under review";
  if (paymentStatus === "failed" || paymentStatus === "expired") return "Payment not completed";
  return "Payment not yet confirmed";
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });
}

export function TrackOrderPage() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [tracking, setTracking] = useState<TrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    try {
      const saved = window.sessionStorage.getItem("vegora-last-order-reference") ?? "";
      const code = shortOrderCode(saved);
      if (code) timer = window.setTimeout(() => setReference(code), 0);
    } catch { /* The form still supports manual entry. */ }
    return () => window.clearTimeout(timer);
  }, []);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError(""); setTracking(null);
    try {
      const response = await fetch("/api/orders/track", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: reference.trim(), email: email.trim() }), cache: "no-store",
      });
      const result = await response.json() as { tracking?: TrackingResult; error?: string };
      if (!response.ok || !result.tracking) throw new Error(result.error || "Order tracking is unavailable right now.");
      setTracking(result.tracking);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order tracking is unavailable right now.");
    } finally { setLoading(false); }
  }

  return <div className="track-page section-pad">
    <div className="track-intro"><span className="eyebrow">VEGORA / YOUR ORDER</span><h1>Track your order.</h1><p>Enter your order number, shown when you paid, and the email you used for the order.</p></div>
    <div className="track-layout">
      <form className="track-form" onSubmit={lookup}>
        <label>Order number<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="VG-7K2M9QXA" maxLength={40} autoCapitalize="characters" autoComplete="off" spellCheck={false} required /></label>
        <label>Order email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" maxLength={254} required /></label>
        <button type="submit" disabled={loading}>{loading ? "Checking…" : "Check order"} <ArrowUpRight size={16} /></button>
        {error && <p className="track-error" role="alert">{error}</p>}
      </form>
      <div className="track-result" aria-live="polite">
        {!tracking ? <div className="track-empty"><span>ORDER PROGRESS</span><h2>Every detail,<br /><em>in its place.</em></h2><p>Delivery updates appear here after your order is confirmed and the team records its progress.</p></div> : <>
          <span className="eyebrow">ORDER {tracking.orderId}</span>
          <h2>{tracking.paymentStatus === "paid" ? statusCopy[tracking.fulfillmentStatus] : unpaidHeading(tracking.paymentStatus)}</h2>
          {tracking.paymentStatus === "paid" ? <>
            <p className="track-status-copy">{tracking.fulfillmentStatus === "unfulfilled" ? "Payment is confirmed. We will update this page as your order moves forward." : tracking.fulfillmentStatus === "preparing" ? "Your order is being prepared for delivery." : tracking.fulfillmentStatus === "dispatched" ? "Your order has been dispatched." : "Your order has been marked delivered."}</p>
            {tracking.trackingReference && <div className="track-reference"><span>DELIVERY REFERENCE</span><strong>{tracking.trackingReference}</strong>{tracking.provider && <small>{tracking.provider}</small>}</div>}
          </> : <p className="track-status-copy">We have not confirmed this order for fulfillment. Contact VEGORA with your order number if you need help.</p>}
          <ol className="track-timeline"><li><strong>Order placed</strong><span>{dateLabel(tracking.placedAt)}</span></li>{tracking.paidAt && <li><strong>Payment confirmed</strong><span>{dateLabel(tracking.paidAt)}</span></li>}{tracking.updates.map((update, index) => <li key={`${update.at}-${index}`}><strong>{statusCopy[update.status as TrackingResult["fulfillmentStatus"]] ?? update.status.replaceAll("_", " ")}</strong><span>{dateLabel(update.at)}</span></li>)}</ol>
        </>}
      </div>
    </div>
    <Link className="line-link track-back" href="/men">Explore the collection <ArrowUpRight size={16} /></Link>
  </div>;
}
