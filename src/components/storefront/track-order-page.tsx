"use client";

import Link from "next/link";
import { ArrowUpRight, Camera, Check, Copy, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatMoney } from "./catalog-types";
import { shortOrderCode } from "@/lib/fulfillment";
import {
  addSavedOrder, maskContact, orderFromSearch, parseSavedOrders, removeSavedOrder, savedOrdersKey, trackLink, type SavedOrder,
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
  { id: "unfulfilled", label: "Order received" },
  { id: "preparing", label: "Getting it ready" },
  { id: "dispatched", label: "On its way" },
  { id: "delivered", label: "Delivered" },
];

const statusCopy: Record<Stage, string> = {
  unfulfilled: "We have your order",
  preparing: "We are getting your order ready",
  dispatched: "On its way",
  delivered: "Delivered",
};

const statusDetail: Record<Stage, string> = {
  unfulfilled: "Your payment worked. This page will change as your order moves on.",
  preparing: "We are packing your order for delivery.",
  dispatched: "Your order has left us and is on its way. Show the delivery code below if the rider asks.",
  delivered: "Your order has been delivered. Thank you for shopping with VEGORA.",
};

const refreshEveryMs = 60_000;

function unpaidHeading(paymentStatus: string) {
  if (paymentStatus === "review_required") return "We are checking your payment";
  if (paymentStatus === "failed" || paymentStatus === "expired") return "Payment did not work";
  return "We are waiting for your payment";
}

function unpaidDetail(paymentStatus: string) {
  if (paymentStatus === "failed" || paymentStatus === "expired") return "This order was not paid, so nothing will be sent. If money left your account, contact VEGORA with your order number. If not, you can order again from your cart.";
  if (paymentStatus === "review_required") return "We are checking this payment. Contact VEGORA with your order number if you need help.";
  return "We have not seen your payment yet. This page checks again by itself. If you paid and nothing changes in a few minutes, contact VEGORA with your order number.";
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
  const [contact, setContact] = useState("");
  const [remember, setRemember] = useState(true);
  const [tracking, setTracking] = useState<TrackingResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<SavedOrder[]>([]);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const current = useRef<{ reference: string; contact: string } | null>(null);
  const busy = useRef(false);

  const run = useCallback(async (code: string, mail: string, keepMessage: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true); if (!keepMessage) { setError(""); }
    try {
      const response = await fetch("/api/orders/track", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: code.trim(), contact: mail.trim() }), cache: "no-store",
      });
      const result = await response.json() as { tracking?: TrackingResult; error?: string };
      if (response.status === 404) throw new Error("We could not find that order. Check your order number, and use the same phone number you gave when you ordered.");
      if (response.status === 429) throw new Error("You have tried too many times. Please wait a few minutes and try again.");
      if (!response.ok || !result.tracking) throw new Error(result.error || "We cannot show your order right now. Please try again in a moment.");
      setTracking(result.tracking); setError(""); setCheckedAt(new Date());
      current.current = { reference: result.tracking.orderId, contact: mail.trim() };
    } catch (cause) {
      if (!keepMessage) setTracking(null);
      setError(cause instanceof Error ? cause.message : "We cannot show your order right now.");
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
      if (match) { setContact(match.contact); void run(match.code, match.contact, false); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [run]);

  // Keep an open order fresh without the customer having to reload.
  useEffect(() => {
    if (!tracking || tracking.fulfillmentStatus === "delivered" || ["failed", "expired"].includes(tracking.paymentStatus)) return;
    const timer = window.setInterval(() => {
      const target = current.current;
      if (target && document.visibilityState === "visible") void run(target.reference, target.contact, true);
    }, refreshEveryMs);
    return () => window.clearInterval(timer);
  }, [tracking, run]);

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTracking(null);
    await run(reference, contact, false);
  }

  // Remember the order only after the server has confirmed the details are right.
  useEffect(() => {
    if (!tracking || !remember || !current.current) return;
    const next = addSavedOrder(readSaved(), tracking.orderId, current.current.contact);
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
    <div className="track-intro"><span className="eyebrow">VEGORA / YOUR ORDER</span><h1>Where is my order?</h1><p>Type your order number and the phone number you used when you ordered. You can check as many times as you like.</p></div>
    <div className="track-layout">
      <div className="track-side">
        {saved.length > 0 && <div className="track-saved"><span className="track-saved-title">ORDERS ON THIS PHONE</span>
          <ul>{saved.map((item) => <li key={item.code}><div><strong translate="no">{item.code}</strong><small>{maskContact(item.contact)}</small></div>
            <button type="button" onClick={() => { setReference(item.code); setContact(item.contact); void run(item.code, item.contact, false); }} disabled={loading}>View</button>
            <button type="button" className="track-saved-forget" onClick={() => forget(item.code)} aria-label={`Forget ${item.code} on this device`}>Forget</button></li>)}</ul></div>}
        <form className="track-form" onSubmit={lookup}>
          <label>Order number<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="VG-7K2M9QXA" maxLength={40} autoCapitalize="characters" autoComplete="off" spellCheck={false} required /></label>
          <label>Phone number<input value={contact} onChange={(event) => setContact(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="024 123 4567" maxLength={30} required /></label>
          <label className="track-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> <span>Remember this order on this phone</span></label>
          <button type="submit" disabled={loading}>{loading ? "Checking…" : "Check order"} <ArrowUpRight size={16} /></button>
          {error && <p className="track-error" role="alert">{error}</p>}
        </form>
        <p className="track-keep"><Camera size={16} aria-hidden="true" /> <span><b>Lost your order number?</b> Contact VEGORA with your phone number and we will find it for you.</span></p>
      </div>
      <div className="track-result" aria-live="polite">
        {!tracking ? <div className="track-empty"><span>ORDER PROGRESS</span><h2>See where<br /><em>your order is.</em></h2><p>You see your order number right after you pay. We do not send emails or texts, so take a screenshot of it. Then come back here to see when your order is packed, sent and delivered.</p></div> : <>
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

          {tracking.trackingReference && <div className="track-reference"><span>DELIVERY CODE</span><strong>{tracking.trackingReference}</strong>{tracking.provider && <small>{tracking.provider}</small>}</div>}

          {tracking.items.length > 0 && <div className="track-items"><span className="track-block-title">YOUR ORDER{tracking.deliveryArea ? ` · DELIVERY IN ${tracking.deliveryArea.toUpperCase()}` : ""}</span>
            <ul>{tracking.items.map((item, index) => <li key={`${item.name}-${item.size}-${index}`}><span>{item.name}<small>Size {item.size} · Qty {item.quantity}</small></span><strong>{formatMoney(item.lineTotalMinor)}</strong></li>)}</ul>
            {tracking.totalMinor !== null && <dl>{tracking.subtotalMinor !== null && <div><dt>Subtotal</dt><dd>{formatMoney(tracking.subtotalMinor)}</dd></div>}{tracking.deliveryFeeMinor !== null && <div><dt>Delivery</dt><dd>{formatMoney(tracking.deliveryFeeMinor)}</dd></div>}<div><dt>Total</dt><dd>{formatMoney(tracking.totalMinor)}</dd></div></dl>}</div>}

          <ol className="track-timeline"><li><strong>You ordered</strong><span>{dateLabel(tracking.placedAt)}</span></li>{tracking.paidAt && <li><strong>Payment received</strong><span>{dateLabel(tracking.paidAt)}</span></li>}{tracking.updates.map((update, index) => <li key={`${update.at}-${index}`}><strong>{statusCopy[update.status as Stage] ?? update.status.replaceAll("_", " ")}</strong><span>{dateLabel(update.at)}</span></li>)}</ol>

          <div className="track-tools">
            <button type="button" onClick={() => current.current && void run(current.current.reference, current.current.contact, true)} disabled={loading}><RefreshCw size={14} aria-hidden="true" /> {loading ? "Checking…" : "Check for news"}</button>
            <button type="button" onClick={() => void copyLink()}>{linkCopied ? <><Check size={14} aria-hidden="true" /> Link copied</> : <><Copy size={14} aria-hidden="true" /> Copy link to this order</>}</button>
          </div>
          <p className="track-checked">{checkedAt ? `Checked ${checkedAt.toLocaleTimeString("en-GH", { timeStyle: "short" })}` : ""}{tracking.fulfillmentStatus !== "delivered" && paid ? " · this page looks for news every minute while it is open" : ""}</p>
        </>}
      </div>
    </div>
    <Link className="line-link track-back" href="/men">See the clothes <ArrowUpRight size={16} /></Link>
  </div>;
}
