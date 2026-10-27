"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { readBag, writeBag } from "./bag-store";

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
        if (data.status === "paid") clearPaidSelection(ref);
      })
      .catch((error) => { if (error.name !== "AbortError") setStatus("error"); });
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);
  const copy = {
    checking: ["Checking your payment", "Please wait while we confirm the result with Paystack."],
    paid: ["Your order is confirmed", "Payment has been verified. Keep your order reference for any enquiries."],
    pending_payment: ["Payment is still pending", "We have not yet confirmed payment. Please check again shortly or contact us with your reference."],
    initializing: ["Payment is still pending", "We have not yet confirmed payment. Please check again shortly or contact us with your reference."],
    failed: ["Payment was not completed", "Your order is not confirmed. You can return to your bag and try again."],
    expired: ["Checkout has expired", "Your order is not confirmed. Please return to your bag and start again."],
    review_required: ["Your order needs a review", "Please contact VEGORA with your reference. We will check the payment before confirming your order."],
    error: ["We could not confirm your payment", "Please contact VEGORA with your payment reference before placing another order."],
  }[status];
  return <div className="checkout-return section-pad"><span className="eyebrow">VEGORA / ORDER STATUS</span><h1>{copy[0]}</h1><p>{copy[1]}</p>{reference && <p className="checkout-reference">Reference <strong>{reference}</strong></p>}
    {(status === "pending_payment" || status === "initializing") && <button type="button" className="outline-button" onClick={() => window.location.reload()}>Check again</button>}
    {status !== "checking" && <Link href={status === "paid" ? "/" : "/bag"} className="line-link">{status === "paid" ? "Return home" : "Return to bag"} <ArrowUpRight size={16} /></Link>}
  </div>;
}
