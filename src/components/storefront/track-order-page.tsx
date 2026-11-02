"use client";

import Link from "next/link";
import { ArrowUpRight, Camera, Check, Copy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatMoney } from "./catalog-types";
import { shortOrderCode } from "@/lib/fulfillment";
import {
  addSavedOrder, maskEmail, orderFromSearch, parseSavedOrders, removeSavedOrder, savedOrdersKey, trackLink, type SavedOrder,
} from "@/lib/saved-orders";

type Stage = "unfulfilled" | "preparing" | "dispatched" | "delivered";

type TrackingResult = {
  orderId: string;
  paymentStatus: string;
  placedAt: string;
  paidAt: string | null;
  fulfillmentStatus: Stage;
  provider: string | null;
  trackingReference: string | null;
  updates: { status: string; at: string }[];
  lastUpdateAt: string;
  deliveryArea: string | null;
  items: { name: string; size: string; quantity: number; lineTotalMinor: number }[];
  subtotalMinor: number | null;
  deliveryFeeMinor: number | null;
  totalMinor: number | null;
};

const stages: { id: Stage; label: string }[] = [
  { id: "unfulfilled", label: "Order confirmed" },
  { id: "preparing", label: "Preparing" },
  { id: "dispatched", label: "On its way" },
  { id: "delivered", label: "Delivered" },
];

const statusCopy: Record<Stage, string> = {
  unfulfilled: "Order confirmed",
  preparing: "Preparing your order",
  dispatched: "On its way",
  delivered: "Delivered",
};

const statusDetail: Record<Stage, string> = {
  unfulfilled: "Payment is confirmed. We will update this page as your order moves forward.",
  preparing: "Your order is being prepared for delivery.",
  dispatched: "Your order has been dispatched. Use the delivery reference below if the rider asks.",
  delivered: "Your order has been marked delivered. Thank you for shopping with VEGORA.",
};

const refreshEveryMs = 60_000;

function unpaidHeading(paymentStatus: string) {
  if (paymentStatus === "review_required") return "Order under review";
  if (paymentStatus === "failed" || paymentStatus === "expired") return "Payment not completed";
  return "Payment not yet confirmed";
}

function unpaidDetail(paymentStatus: string) {
  if (paymentStatus === "failed" || paymentStatus === "expired") return "This order was not paid, so nothing will be delivered. If money left your account, contact VEGORA with your order number. Otherwise you can place the order again from your bag.";
  if (paymentStatus === "review_required") return "We are checking this payment before confirming the order. Contact VEGORA with your order number if you need help.";
  return "We have not confirmed payment for this order yet. This page checks again by itself. If you paid and it does not change in a few minutes, contact VEGORA with your order number.";
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });
}

function readSaved(): SavedOrder[] {
  try { return parseSavedOrders(window.localStorage.getItem(savedOrdersKey)); } catch { return []; }
}

function writeSaved(list: SavedOrder[]) {
  try { window.localStorage.setItem(savedOrdersKey, JSON.stringify(list)); } catch { /* Remembering is optional. */ }
}

export function TrackOrderPage() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(true);
  const [tracking, setTracking] = useState<TrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<SavedOrder[]>([]);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const current = useRef<{ reference: string; email: string } | null>(null);
  const busy = useRef(false);

  const run = useCallback(async (code: string, mail: string, keepMessage: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true); if (!keepMessage) { setError(""); }
    try {
      const response = await fetch("/api/orders/track", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: code.trim(), email: mail.trim() }), cache: "no-store",
      });
      const result = await response.json() as { tracking?: TrackingResult; error?: string };
      if (response.status === 404) throw new Error("We could not find an order with those details. Check the order number, and use the exact email address you entered at checkout.");
      if (response.status === 429) throw new Error("Too many tries. Please wait a few minutes, then try again.");
      if (!response.ok || !result.tracking) throw new Error(result.error || "Order tracking is unavailable right now. Please try again in a moment.");
      setTracking(result.tracking); setError(""); setCheckedAt(new Date());
      current.current = { reference: result.tracking.orderId, email: mail.trim().toLowerCase() };
    } catch (cause) {
      if (!keepMessage) setTracking(null);
      setError(cause instanceof Error ? cause.message : "Order tracking is unavailable right now.");
    } finally { busy.current = false; setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const list = readSaved();
      setSaved(list);
      const fromLink = orderFromSearch(window.location.search);
      let last = "";
      try { last = window.sessionStorage.getItem("vegora-last-order-reference") ?? ""; } catch { /* Manual entry still works. */ }
      const code = fromLink ?? shortOrderCode(last) ?? "";
      if (code) setReference(code);
      // Opened from a link on a device that remembers this order: show it straight away.
      const match = fromLink ? list.find((item) => item.code === fromLink) : null;
      if (match) { setEmail(match.email); void run(match.code, match.email, false); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [run]);

  // Keep an open order fresh without the customer having to reload.
  useEffect(() => {
    if (!tracking || tracking.fulfillmentStatus === "delivered" || ["failed", "expired"].includes(tracking.paymentStatus)) return;
    const timer = window.setInterval(() => {
      const target = current.current;
      if (target && document.visibilityState === "visible") void run(target.reference, target.email, true);
    }, refreshEveryMs);
    return () => window.clearInterval(timer);
  }, [tracking, run]);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTracking(null);
    await run(reference, email, false);
  }

  // Remember the order only after the server has confirmed the details are right.
  useEffect(() => {
    if (!tracking || !remember || !current.current) return;
    const next = addSavedOrder(readSaved(), tracking.orderId, current.current.email);
    writeSaved(next); setSaved(next);
  }, [tracking, remember]);

  function forget(code: string) {
    const next = removeSavedOrder(readSaved(), code);
    writeSaved(next); setSaved(next);
    if (tracking?.orderId === code) setRemember(false);
  }

  async function copyLink() {
    if (!tracking) return;
    try { await navigator.clipboard.writeText(trackLink(window.location.origin, tracking.orderId)); setLinkCopied(true); window.setTimeout(() => setLinkCopied(false), 3000); } catch { /* The address bar still has it. */ }
  }

  const paid = tracking?.paymentStatus === "paid";
  const stageIndex = tracking ? stages.findIndex((stage) => stage.id === tracking.fulfillmentStatus) : -1;
  const stageTime = (id: Stage) => id === "unfulfilled" ? tracking?.paidAt ?? null : tracking?.updates.find((update) => update.status === id)?.at ?? null;

  return <div className="track-page section-pad">
    <div className="track-intro"><span className="eyebrow">VEGORA / YOUR ORDER</span><h1>Track your order.</h1><p>Enter the order number you saved after paying, and the email you used at checkout. You can check as often as you like.</p></div>
    <div className="track-layout">
      <div className="track-side">
        {saved.length > 0 && <div className="track-saved"><span className="track-saved-title">ORDERS ON THIS DEVICE</span>
          <ul>{saved.map((item) => <li key={item.code}><div><strong translate="no">{item.code}</strong><small>{maskEmail(item.email)}</small></div>
            <button type="button" onClick={() => { setReference(item.code); setEmail(item.email); void run(item.code, item.email, false); }} disabled={loading}>View</button>
            <button type="button" className="track-saved-forget" onClick={() => forget(item.code)} aria-label={`Forget ${item.code} on this device`}>Forget</button></li>)}</ul></div>}
        <form className="track-form" onSubmit={lookup}>
          <label>Order number<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="VG-7K2M9QXA" maxLength={40} autoCapitalize="characters" autoComplete="off" spellCheck={false} required /></label>
          <label>Order email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" maxLength={254} required /></label>
          <label className="track-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> <span>Remember this order on this device</span></label>
          <button type="submit" disabled={loading}>{loading ? "Checking…" : "Check order"} <ArrowUpRight size={16} /></button>
          {error && <p className="track-error" role="alert">{error}</p>}
        </form>
        <p className="track-keep"><Camera size={16} aria-hidden="true" /> <span><b>Lost your order number?</b> Contact VEGORA with the email you used and we can find it for you.</span></p>
      </div>
      <div className="track-result" aria-live="polite">
        {!tracking ? <div className="track-empty"><span>ORDER PROGRESS</span><h2>Every detail,<br /><em>in its place.</em></h2><p>Your order number is shown right after you pay. We do not send emails or texts, so take a screenshot of it. Updates then appear here as your order is prepared, sent and delivered.</p></div> : <>
          <span className="eyebrow">ORDER {tracking.orderId}</span>
          <h2>{paid ? statusCopy[tracking.fulfillmentStatus] : unpaidHeading(tracking.paymentStatus)}</h2>
          <p className="track-status-copy">{paid ? statusDetail[tracking.fulfillmentStatus] : unpaidDetail(tracking.paymentStatus)}</p>

          {paid && <ol className="track-steps" aria-label="Order progress">{stages.map((stage, index) => {
            const at = stageTime(stage.id);
            return <li key={stage.id} data-state={index < stageIndex ? "done" : index === stageIndex ? "current" : "next"} aria-current={index === stageIndex ? "step" : undefined}>
              <i aria-hidden="true">{index <= stageIndex ? <Check size={12} /> : null}</i>
              <strong>{stage.label}</strong>{at && index <= stageIndex && <small>{dateLabel(at)}</small>}
            </li>;
          })}</ol>}

          {tracking.trackingReference && <div className="track-reference"><span>DELIVERY REFERENCE</span><strong>{tracking.trackingReference}</strong>{tracking.provider && <small>{tracking.provider}</small>}</div>}

          {tracking.items.length > 0 && <div className="track-items"><span className="track-block-title">YOUR ORDER{tracking.deliveryArea ? ` · DELIVERY TO ${tracking.deliveryArea.toUpperCase()}` : ""}</span>
            <ul>{tracking.items.map((item, index) => <li key={`${item.name}-${item.size}-${index}`}><span>{item.name}<small>Size {item.size} · Qty {item.quantity}</small></span><strong>{formatMoney(item.lineTotalMinor)}</strong></li>)}</ul>
            {tracking.totalMinor !== null && <dl>{tracking.subtotalMinor !== null && <div><dt>Subtotal</dt><dd>{formatMoney(tracking.subtotalMinor)}</dd></div>}{tracking.deliveryFeeMinor !== null && <div><dt>Delivery</dt><dd>{formatMoney(tracking.deliveryFeeMinor)}</dd></div>}<div><dt>Total</dt><dd>{formatMoney(tracking.totalMinor)}</dd></div></dl>}</div>}

          <ol className="track-timeline"><li><strong>Order placed</strong><span>{dateLabel(tracking.placedAt)}</span></li>{tracking.paidAt && <li><strong>Payment confirmed</strong><span>{dateLabel(tracking.paidAt)}</span></li>}{tracking.updates.map((update, index) => <li key={`${update.at}-${index}`}><strong>{statusCopy[update.status as Stage] ?? update.status.replaceAll("_", " ")}</strong><span>{dateLabel(update.at)}</span></li>)}</ol>

          <div className="track-tools">
            <button type="button" onClick={() => current.current && void run(current.current.reference, current.current.email, true)} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> {loading ? "Checking…" : "Check for updates"}</button>
            <button type="button" onClick={() => void copyLink()}>{linkCopied ? <><Check size={14} aria-hidden="true" /> Link copied</> : <><Copy size={14} aria-hidden="true" /> Copy link to this order</>}</button>
          </div>
          <p className="track-checked">{checkedAt ? `Checked ${checkedAt.toLocaleTimeString("en-GH", { timeStyle: "short" })}` : ""}{tracking.fulfillmentStatus !== "delivered" && paid ? " · this page checks again every minute while it is open" : ""}</p>
        </>}
      </div>
    </div>
    <Link className="line-link track-back" href="/men">Explore the collection <ArrowUpRight size={16} /></Link>
  </div>;
}
