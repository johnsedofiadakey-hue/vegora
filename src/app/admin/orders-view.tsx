"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { formatGhs } from "@/lib/catalog";
import { isPlaceholderEmail } from "@/lib/contact";
import { formatVoucherCode } from "@/lib/voucher";
import { shortOrderCode, type Fulfillment, type FulfillmentEvent, type FulfillmentInput } from "@/lib/fulfillment";
import { deliveryUnlocked, isCodOrder, needsPhoneConfirmation, canCancelCod } from "@/lib/payment-method";
import { FulfillmentEditor } from "./fulfillment-editor";
import admin from "./admin.module.css";
import styles from "./studio.module.css";

export interface AdminOrder {
  reference: string;
  status: string;
  email: string;
  customer: { name: string; phone: string };
  delivery: { zoneLabel: string; addressLine1: string; addressLine2: string; city: string; region: string; notes: string };
  lines: { slug: string; name: string; size: string; sku: string; quantity: number; unitPriceMinor?: number; lineTotalMinor: number }[];
  subtotalMinor: number;
  discountMinor?: number;
  voucher?: { code: string; percentOff: number; label: string } | null;
  deliveryFeeMinor: number;
  totalMinor: number;
  createdAt: string;
  paidAt: string | null;
  fulfillment?: Fulfillment;
  paymentMethod?: string;
  codConfirmedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

const paymentLabel: Record<string, string> = {
  initializing: "Awaiting payment", pending_payment: "Awaiting payment", paid: "Paid",
  failed: "Payment failed", expired: "Not paid", review_required: "Needs review",
  pay_on_delivery: "Pay on delivery", cancelled: "Cancelled",
};
const deliveryLabel: Record<string, string> = {
  unfulfilled: "To pack", preparing: "Preparing", dispatched: "On the way", delivered: "Delivered",
};

/** Orders that have not reached the customer yet and can move: paid, or pay on delivery and confirmed. */
export function needsDelivery(order: AdminOrder): boolean {
  return deliveryUnlocked(order) && (order.fulfillment?.status ?? "unfulfilled") !== "delivered";
}

/** Everything waiting on the admin: orders to deliver, and pay-on-delivery orders waiting for the phone call. */
export function needsAttention(order: AdminOrder): boolean {
  return needsDelivery(order) || needsPhoneConfirmation(order);
}

function tone(order: AdminOrder): string {
  if (order.status === "review_required" || needsPhoneConfirmation(order)) return styles.pill_alert;
  if (!deliveryUnlocked(order)) return styles.pill_archived;
  return (order.fulfillment?.status ?? "unfulfilled") === "delivered" ? styles.pill_published : styles.pill_todo;
}

function statusText(order: AdminOrder): string {
  if (needsPhoneConfirmation(order)) return "Call to confirm";
  return deliveryUnlocked(order) ? deliveryLabel[order.fulfillment?.status ?? "unfulfilled"] : paymentLabel[order.status] ?? order.status.replaceAll("_", " ");
}

function Thumb({ src, size }: { src?: string; size: number }) {
  return <span className={styles.thumb} style={{ width: size, height: Math.round(size * 4 / 3) }}>
    {src ? <Image src={src} alt="" width={size * 2} height={Math.round(size * 8 / 3)} loading="eager" unoptimized /> : null}
  </span>;
}

export function OrdersView({ orders, products, selected, detailOpen, events, message, busy, onSelect, onBack, onRefresh, onSaveFulfillment, onCodAction }: {
  orders: AdminOrder[];
  products: Product[];
  selected: string | null;
  detailOpen: boolean;
  events: FulfillmentEvent[];
  message: string;
  busy: boolean;
  onSelect: (reference: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  onSaveFulfillment: (reference: string, input: FulfillmentInput) => Promise<void>;
  onCodAction: (reference: string, action: "confirm" | "cancel", reason?: string) => Promise<void>;
}) {
  const cover = new Map(products.map((product) => [product.slug, product.images[0]?.url]));
  const [query, setQuery] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  // Customers quote their order number, or the email they used: find either quickly.
  const needle = query.trim().toLowerCase().replace(/\s+/g, "");
  const digits = needle.replace(/[^0-9]/g, "");
  const visible = !needle ? orders : orders.filter((item) =>
    (shortOrderCode(item.reference) ?? "").toLowerCase().replace("-", "").includes(needle.replace("-", "")) ||
    item.reference.toLowerCase().includes(needle) || item.email.toLowerCase().includes(needle) ||
    item.customer.name.toLowerCase().replace(/\s+/g, "").includes(needle) ||
    (digits.length >= 4 && item.customer.phone.replace(/[^0-9]/g, "").includes(digits)));
  const order = visible.find((item) => item.reference === selected) ?? visible[0] ?? (needle ? undefined : orders[0]);
  const todo = orders.filter(needsDelivery).length;
  const toConfirm = orders.filter(needsPhoneConfirmation).length;
  const when = (value: string) => new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });

  return <section className={`${styles.page} ${styles.ordersPage} ${detailOpen ? styles.showDetail : ""}`} aria-labelledby="orders-title">
    <div className={styles.orderList}>
      <div className={styles.pageHead}>
        <div><p className={styles.kicker}>Order desk</p><h1 id="orders-title">Orders</h1></div>
        <button type="button" className={styles.secondary} onClick={onRefresh} disabled={busy}><RefreshCw size={15} aria-hidden="true" />Refresh</button>
      </div>
      <p className={styles.lead}>{orders.length === 0 ? "Paid orders will appear here." : [
        toConfirm > 0 ? `${toConfirm} pay-on-delivery ${toConfirm === 1 ? "order needs" : "orders need"} a phone call to confirm.` : "",
        todo > 0 ? `${todo} ${todo === 1 ? "order needs" : "orders need"} packing or delivery.` : toConfirm === 0 ? "Every order has been delivered." : "",
      ].filter(Boolean).join(" ")}</p>
      {message && !detailOpen && <p role="status" className={admin.message}>{message}</p>}
      {orders.length > 0 && <label className={styles.orderSearch}><Search size={15} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find by order number, phone or name" aria-label="Find an order" autoComplete="off" /></label>}
      {needle && visible.length === 0 && <p className={styles.lead} role="status">No order matches “{query.trim()}”. Check the spelling, or try the email the customer used.</p>}
      <ul>{visible.map((item) => <li key={item.reference}>
        <button type="button" aria-current={order?.reference === item.reference ? "true" : undefined} onClick={() => onSelect(item.reference)}>
          <Thumb src={cover.get(item.lines[0]?.slug)} size={48} />
          <span className={styles.orderLine}>
            <strong>{item.customer.name}</strong>
            <small>{shortOrderCode(item.reference) ?? item.reference} · {item.lines.reduce((sum, line) => sum + line.quantity, 0)} {item.lines.length === 1 && item.lines[0].quantity === 1 ? "item" : "items"} · {new Date(item.createdAt).toLocaleDateString("en-GH", { day: "numeric", month: "short" })}</small>
          </span>
          <span className={styles.orderSide}><strong>{formatGhs(item.totalMinor)}</strong><em className={tone(item)}>{statusText(item)}</em></span>
        </button>
      </li>)}</ul>
    </div>

    <div className={styles.orderDetail}>
      <button type="button" className={styles.back} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />All orders</button>
      {message && detailOpen && <p role="status" className={admin.message}>{message}</p>}
      {order ? <>
        <div className={styles.pageHead}>
          <div><p className={styles.kicker}>Order {shortOrderCode(order.reference) ?? order.reference}</p><h1>{order.customer.name}</h1></div>
          <em className={tone(order)}>{statusText(order)}</em>
        </div>
        <p className={styles.fieldNote}>Placed {when(order.createdAt)}{order.paidAt ? ` · Paid ${when(order.paidAt)}` : ""} · {isCodOrder(order) ? `Pay on delivery${order.status === "paid" ? " (cash received)" : ""}` : paymentLabel[order.status] ?? order.status} · Ref {order.reference}</p>

        <div className={styles.card}>
          <h2>Items</h2>
          <ul className={styles.itemList}>{order.lines.map((line) => <li key={`${line.slug}-${line.sku}-${line.size}`}>
            <Thumb src={cover.get(line.slug)} size={64} />
            <span><strong>{line.name}</strong><small>Size {line.size} · Qty {line.quantity} · {line.sku}</small></span>
            <strong>{formatGhs(line.lineTotalMinor)}</strong>
          </li>)}</ul>
          <dl className={styles.totals}>
            <div><dt>Subtotal</dt><dd>{formatGhs(order.subtotalMinor)}</dd></div>
            {!!order.discountMinor && <div><dt>Voucher{order.voucher ? ` ${order.voucher.percentOff}% off` : ""}</dt><dd>−{formatGhs(order.discountMinor)}</dd></div>}
            <div><dt>Delivery</dt><dd>{formatGhs(order.deliveryFeeMinor)}</dd></div>
            <div><dt>Total</dt><dd>{formatGhs(order.totalMinor)}</dd></div>
            {order.status === "pay_on_delivery" && <div><dt><strong>To collect on delivery</strong></dt><dd><strong>{formatGhs(order.totalMinor)}</strong></dd></div>}
          </dl>
          {order.voucher && <p className={styles.fieldNote}>Voucher {formatVoucherCode(order.voucher.code)} · {order.voucher.label}</p>}
        </div>

        <div className={styles.card}>
          <h2>Customer and delivery</h2>
          <p><a href={`tel:${order.customer.phone.replace(/[^+0-9]/g, "")}`}>{order.customer.phone}</a><br />{isPlaceholderEmail(order.email) ? null : <a href={`mailto:${order.email}`}>{order.email}</a>}</p>
          <p>{order.delivery.addressLine1}{order.delivery.addressLine2 ? `, ${order.delivery.addressLine2}` : ""}<br />{order.delivery.city}, {order.delivery.region}<br />{order.delivery.zoneLabel}</p>
          {order.delivery.notes && <p className={styles.note}>Note: {order.delivery.notes}</p>}
        </div>

        {isCodOrder(order) && order.status !== "paid" && <div className={styles.card}>
          <h2>Pay on delivery</h2>
          {order.status === "cancelled"
            ? <p className={styles.note}>Cancelled {order.cancelledAt ? when(order.cancelledAt) : ""}.{order.cancelReason ? ` Reason: ${order.cancelReason}` : ""} The stock went back on sale.</p>
            : needsPhoneConfirmation(order) ? <>
              <p className={styles.warn}>This order is not confirmed yet. Do not pack it until you have spoken to the customer.</p>
              <ol className={styles.codSteps}>
                <li>Ring <a href={`tel:${order.customer.phone.replace(/[^+0-9]/g, "")}`}>{order.customer.phone}</a> and check it was them.</li>
                <li>Check the items and the delivery address.</li>
                <li>Tell them they will pay <strong>{formatGhs(order.totalMinor)}</strong> to the rider on delivery.</li>
                <li>Press <strong>Confirm order</strong>. Unconfirmed orders are cancelled by the system after 2 days and the stock goes back on sale.</li>
              </ol>
            </> : <p className={styles.note}>Confirmed {order.codConfirmedAt ? when(order.codConfirmedAt) : ""}. The customer pays <strong>{formatGhs(order.totalMinor)}</strong> on delivery. When you mark it Delivered below, you will be asked to confirm the money was received.</p>}
          {canCancelCod(order) && (cancelling === order.reference
            ? <div className={styles.confirm} role="alertdialog" aria-label="Cancel this order">
              <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} placeholder="Why? (optional, for your records)" aria-label="Reason for cancelling" />
              <button type="button" className={styles.danger} disabled={busy} onClick={() => { void onCodAction(order.reference, "cancel", reason); setCancelling(null); setReason(""); }}>Cancel the order</button>
              <button type="button" className={styles.secondary} onClick={() => setCancelling(null)}>Keep it</button>
            </div>
            : <div className={styles.codActions}>
              {needsPhoneConfirmation(order) && <button type="button" className={styles.primary} disabled={busy} onClick={() => void onCodAction(order.reference, "confirm")}>Confirm order</button>}
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => setCancelling(order.reference)}>Cancel order</button>
            </div>)}
        </div>}

        <div className={`${styles.card} ${admin.editor}`}>
          <FulfillmentEditor key={`${order.reference}-${order.fulfillment?.updatedAt ?? "new"}`} order={order} busy={busy} onSave={onSaveFulfillment} />
          {events.length > 0 && <div className={admin.fulfillmentHistory}><h2>Delivery updates</h2><ol>{events.map((event) => <li key={`${event.at}-${event.status}-${event.kind ?? "advance"}`}><strong>{deliveryLabel[event.status] ?? event.status}</strong>{event.kind === "rollback" && <em>Moved back</em>}{event.kind === "update" && <em>Details updated</em>}<span>{when(event.at)}</span>{event.trackingReference && <small>{event.provider} · {event.trackingReference}</small>}{event.note && <q>{event.note}</q>}</li>)}</ol></div>}
        </div>
      </> : <div className={styles.empty}><h2>No orders yet.</h2><p>When a customer pays, their order appears here with what to pack and where to deliver it.</p></div>}
    </div>
  </section>;
}
