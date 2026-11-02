"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { readBag, writeBag } from "./bag-store";
import { shortOrderCode } from "@/lib/fulfillment";
import { addSavedOrder, parseSavedOrders, removeSavedOrder, savedOrdersKey } from "@/lib/saved-orders";
import { OrderNumberCard } from "./order-number-card";

type OrderStatus = "initializing" | "pending_payment" | "paid" | "failed" | "expired" | "review_required";

function clearPaidSelection(reference: string) {
  try {
    const key = `vegora-checkout-v1:${reference}`;
    const stored = JSON.parse(window.sessionStorage.getItem(key) || "null") as unknown;
    if (!Array.isArray(stored)) return;
    const purchased = new Map(stored.filter((entry) => entry && typeof entry.key === "string" && Number.isInteger(entry.quantity) && entry.quantity > 0).map((entry) => [entry.key as string, entry.quantity as number]));
    writeBag(readBag().map((item) => ({ ...item, quantity: Math.max(0, item.quantity - (purchased.get(item.key) || 0)) })).filter((item) => item.quantity > 0));
    window.sessionStorage.removeItem(key);
  } catch { /* Keep the bag if browser storage is unavailable. */ }
}

export function CheckoutReturnPage() {
  const [status, setStatus] = useState<OrderStatus | "checking" | "error">("checking");
  const [reference, setReference] = useState("");
  const [remembered, setRemembered] = useState(false);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("reference") || "";
    const timer = window.setTimeout(() => setReference(ref), 0);
    if (!/^VG-[0-9a-f]{32}$/.test(ref)) {
      const errorTimer = window.setTimeout(() => setStatus("error"), 0);
      return () => { window.clearTimeout(timer); window.clearTimeout(errorTimer); };
    }
    const controller = new AbortController();
    fetch(`/api/checkout/verify?reference=${encodeURIComponent(ref)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Verification unavailable");
        const data = await response.json() as { status?: OrderStatus };
        if (!data.status || !["initializing", "pending_payment", "paid", "failed", "expired", "review_required"].includes(data.status)) throw new Error("Verification unavailable");
        setStatus(data.status);
        if (data.status === "paid") {
          clearPaidSelection(ref);
          try { window.sessionStorage.setItem("vegora-last-order-reference", ref); } catch { /* Manual entry remains available. */ }
          // The email was typed at checkout on this device; keep it with the order number so
          // Track order can open the order in one tap. It stays in this browser only.
          try {
            const code = shortOrderCode(ref);
            const email = window.sessionStorage.getItem(`vegora-checkout-email:${ref}`);
            if (code && email) {
              const list = addSavedOrder(parseSavedOrders(window.localStorage.getItem(savedOrdersKey)), code, email);
              window.localStorage.setItem(savedOrdersKey, JSON.stringify(list));
              window.sessionStorage.removeItem(`vegora-checkout-email:${ref}`);
              setRemembered(list.some((item) => item.code === code));
            }
          } catch { /* Remembering is optional. */ }
        }
      })
      .catch((error) => { if (error.name !== "AbortError") setStatus("error"); });
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);
  const copy = {
    checking: ["Checking your payment", "Please wait while we confirm the result with Paystack."],
    paid: ["Your order is confirmed", "Payment has been verified. Your order number is below. Save it, then follow your delivery any time on the Track order page."],
    pending_payment: ["Payment is still pending", "We have not yet confirmed payment. Please check again shortly or contact us with your order number."],
    initializing: ["Payment is still pending", "We have not yet confirmed payment. Please check again shortly or contact us with your order number."],
    failed: ["Payment was not completed", "Your order is not confirmed. You can return to your bag and try again."],
    expired: ["Checkout has expired", "Your order is not confirmed. Please return to your bag and start again."],
    review_required: ["Your order needs a review", "Please contact VEGORA with your order number. We will check the payment before confirming your order."],
    error: ["We could not confirm your payment", "Please contact VEGORA with your order number before placing another order."],
  }[status];
  return <div className="checkout-return section-pad"><span className="eyebrow">VEGORA / ORDER STATUS</span><h1>{copy[0]}</h1><p>{copy[1]}</p>{reference && shortOrderCode(reference) && ["paid", "pending_payment", "initializing", "review_required"].includes(status) && <OrderNumberCard code={shortOrderCode(reference) as string} remembered={remembered} onForget={() => {
      try { const code = shortOrderCode(reference) as string; window.localStorage.setItem(savedOrdersKey, JSON.stringify(removeSavedOrder(parseSavedOrders(window.localStorage.getItem(savedOrdersKey)), code))); } catch { /* Nothing to forget. */ }
      setRemembered(false);
    }} />}
    {reference && ["error", "failed", "expired"].includes(status) && <p className="checkout-reference">Order number <strong>{shortOrderCode(reference) ?? reference}</strong></p>}
    {(status === "pending_payment" || status === "initializing") && <button type="button" className="outline-button" onClick={() => window.location.reload()}>Check again</button>}
    {status === "paid" && <Link href="/track" className="line-link">Track your order <ArrowUpRight size={16} /></Link>}
    {status !== "checking" && <Link href={status === "paid" ? "/" : "/bag"} className="line-link">{status === "paid" ? "Return home" : "Return to bag"} <ArrowUpRight size={16} /></Link>}
  </div>;
}
