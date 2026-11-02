"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { formatGhs } from "@/lib/catalog";
import { shortOrderCode, type Fulfillment, type FulfillmentEvent, type FulfillmentInput } from "@/lib/fulfillment";
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
  deliveryFeeMinor: number;
  totalMinor: number;
  createdAt: string;
  paidAt: string | null;
  fulfillment?: Fulfillment;
}

const paymentLabel: Record<string, string> = {
  initializing: "Awaiting payment", pending_payment: "Awaiting payment", paid: "Paid",
  failed: "Payment failed", expired: "Not paid", review_required: "Needs review",
};
const deliveryLabel: Record<string, string> = {
  unfulfilled: "To pack", preparing: "Preparing", dispatched: "On the way", delivered: "Delivered",
};

/** Paid orders that have not reached the customer yet: the admin's to-do list. */
export function needsDelivery(order: AdminOrder): boolean {
  return order.status === "paid" && (order.fulfillment?.status ?? "unfulfilled") !== "delivered";
}

function tone(order: AdminOrder): string {
  if (order.status === "review_required") return styles.pill_alert;
  if (order.status !== "paid") return styles.pill_archived;
  return (order.fulfillment?.status ?? "unfulfilled") === "delivered" ? styles.pill_published : styles.pill_todo;
}

function statusText(order: AdminOrder): string {
  return order.status === "paid" ? deliveryLabel[order.fulfillment?.status ?? "unfulfilled"] : paymentLabel[order.status] ?? order.status.replaceAll("_", " ");
}

function Thumb({ src, size }: { src?: string; size: number }) {
  return <span className={styles.thumb} style={{ width: size, height: Math.round(size * 4 / 3) }}>
    {src ? <Image src={src} alt="" width={size * 2} height={Math.round(size * 8 / 3)} loading="eager" unoptimized /> : null}
  </span>;
}

export function OrdersView({ orders, products, selected, detailOpen, events, message, busy, onSelect, onBack, onRefresh, onSaveFulfillment }: {
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
}) {
  const cover = new Map(products.map((product) => [product.slug, product.images[0]?.url]));
  const [query, setQuery] = useState("");
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
  const when = (value: string) => new Date(value).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });

  return <section className={`${styles.page} ${styles.ordersPage} ${detailOpen ? styles.showDetail : ""}`} aria-labelledby="orders-title">
    <div className={styles.orderList}>
      <div className={styles.pageHead}>
        <div><p className={styles.kicker}>Order desk</p><h1 id="orders-title">Orders</h1></div>
        <button type="button" className={styles.secondary} onClick={onRefresh} disabled={busy}><RefreshCw size={15} aria-hidden="true" />Refresh</button>
      </div>
      <p className={styles.lead}>{orders.length === 0 ? "Paid orders will appear here." : todo > 0 ? `${todo} paid ${todo === 1 ? "order needs" : "orders need"} packing or delivery.` : "Every paid order has been delivered."}</p>
      {message && !detailOpen && <p role="status" className={admin.message}>{message}</p>}
      {orders.length > 0 && <label className={styles.orderSearch}><Search size={15} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find by order number, email, name or phone" aria-label="Find an order" autoComplete="off" /></label>}
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
        <p className={styles.fieldNote}>Placed {when(order.createdAt)}{order.paidAt ? ` · Paid ${when(order.paidAt)}` : ""} · {paymentLabel[order.status] ?? order.status} · Ref {order.reference}</p>

        <div className={styles.card}>
          <h2>Items</h2>
          <ul className={styles.itemList}>{order.lines.map((line) => <li key={`${line.slug}-${line.sku}-${line.size}`}>
            <Thumb src={cover.get(line.slug)} size={64} />
            <span><strong>{line.name}</strong><small>Size {line.size} · Qty {line.quantity} · {line.sku}</small></span>
            <strong>{formatGhs(line.lineTotalMinor)}</strong>
          </li>)}</ul>
          <dl className={styles.totals}>
            <div><dt>Subtotal</dt><dd>{formatGhs(order.subtotalMinor)}</dd></div>
            <div><dt>Delivery</dt><dd>{formatGhs(order.deliveryFeeMinor)}</dd></div>
            <div><dt>Total</dt><dd>{formatGhs(order.totalMinor)}</dd></div>
          </dl>
        </div>

        <div className={styles.card}>
          <h2>Customer and delivery</h2>
          <p><a href={`tel:${order.customer.phone.replace(/[^+0-9]/g, "")}`}>{order.customer.phone}</a><br /><a href={`mailto:${order.email}`}>{order.email}</a></p>
          <p>{order.delivery.addressLine1}{order.delivery.addressLine2 ? `, ${order.delivery.addressLine2}` : ""}<br />{order.delivery.city}, {order.delivery.region}<br />{order.delivery.zoneLabel}</p>
          {order.delivery.notes && <p className={styles.note}>Note: {order.delivery.notes}</p>}
        </div>

        <div className={`${styles.card} ${admin.editor}`}>
          <FulfillmentEditor key={`${order.reference}-${order.fulfillment?.updatedAt ?? "new"}`} order={order} busy={busy} onSave={onSaveFulfillment} />
          {events.length > 0 && <div className={admin.fulfillmentHistory}><h2>Delivery updates</h2><ol>{events.map((event) => <li key={`${event.at}-${event.status}-${event.kind ?? "advance"}`}><strong>{deliveryLabel[event.status] ?? event.status}</strong>{event.kind === "rollback" && <em>Moved back</em>}{event.kind === "update" && <em>Details updated</em>}<span>{when(event.at)}</span>{event.trackingReference && <small>{event.provider} · {event.trackingReference}</small>}{event.note && <q>{event.note}</q>}</li>)}</ol></div>}
        </div>
      </> : <div className={styles.empty}><h2>No orders yet.</h2><p>When a customer pays, their order appears here with what to pack and where to deliver it.</p></div>}
    </div>
  </section>;
}
