import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { CheckoutConfig, DeliveryZone } from "./checkout-config";
import { matchingDeliveryZone } from "./checkout-config";
import { storeDb } from "./firebase-admin";
import { HttpError } from "./http";
import { readStoredProduct, type StoredProduct } from "./products";
import type { PaystackVerification } from "./paystack";
import { paymentAction, type OrderStatus } from "./payment-policy";
import { paymentConfig } from "./checkout-config";
import { verifyPaystack } from "./paystack";

export type { OrderStatus } from "./payment-policy";

export interface CheckoutItem { slug: string; variantId: string; quantity: number }
export interface CheckoutInput {
  email: string;
  customer: { name: string; phone: string };
  delivery: { zoneId: string; addressLine1: string; addressLine2: string; city: string; region: string; notes: string };
  items: CheckoutItem[];
  idempotencyKey: string;
}
export interface OrderLine extends CheckoutItem { name: string; size: string; sku: string; unitPriceMinor: number; lineTotalMinor: number }
export interface Order {
  reference: string;
  fingerprint: string;
  status: OrderStatus;
  email: string;
  customer: CheckoutInput["customer"];
  delivery: CheckoutInput["delivery"] & { zoneLabel: string; feeMinor: number };
  lines: OrderLine[];
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: "GHS";
  authorizationUrl: string | null;
  createdAt: string;
  updatedAt: string;
  reservationExpiresAt: string;
  paymentStatus: string | null;
  paidAt: string | null;
}

function boundedText(value: unknown, name: string, max: number, required = true): string {
  if (typeof value !== "string") throw new HttpError(400, `${name} is required`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) throw new HttpError(400, `${name} is invalid`);
  return clean;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Invalid checkout details");
  return value as Record<string, unknown>;
}

export function parseCheckoutInput(value: unknown): CheckoutInput {
  const input = object(value);
  const email = boundedText(input.email, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Email is invalid");
  const customer = object(input.customer);
  const name = boundedText(customer.name, "Name", 150);
  const phone = boundedText(customer.phone, "Phone", 30);
  if (!/^[+0-9()\s-]{8,30}$/.test(phone)) throw new HttpError(400, "Phone is invalid");
  const delivery = object(input.delivery);
  const zoneId = boundedText(delivery.zoneId, "Delivery zone", 50);
  const addressLine1 = boundedText(delivery.addressLine1, "Address", 200);
  const addressLine2 = boundedText(delivery.addressLine2 ?? "", "Address line 2", 200, false);
  const city = boundedText(delivery.city, "City", 100);
  const region = boundedText(delivery.region, "Region", 100);
  const notes = boundedText(delivery.notes ?? "", "Delivery notes", 500, false);
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 30) {
    throw new HttpError(400, "Choose 1–30 items");
  }
  const items = input.items.map((line) => {
    const item = object(line);
    const slug = boundedText(item.slug, "Product", 80);
    const variantId = boundedText(item.variantId, "Size", 80);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[a-zA-Z0-9_-]{1,80}$/.test(variantId) ||
        !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 10) {
      throw new HttpError(400, "Invalid item or quantity");
    }
    return { slug, variantId, quantity: Number(item.quantity) };
  });
  if (new Set(items.map((item) => `${item.slug}:${item.variantId}`)).size !== items.length) {
    throw new HttpError(400, "Duplicate size in bag");
  }
  const idempotencyKey = boundedText(input.idempotencyKey, "Checkout key", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new HttpError(400, "Checkout key must be a random UUID");
  }
  return { email, customer: { name, phone },
    delivery: { zoneId, addressLine1, addressLine2, city, region, notes },
    items, idempotencyKey: idempotencyKey.toLowerCase() };
}

export function checkoutFingerprint(input: CheckoutInput): string {
  return createHash("sha256").update(JSON.stringify({ ...input,
    items: [...input.items].sort((a, b) => `${a.slug}:${a.variantId}`.localeCompare(`${b.slug}:${b.variantId}`)),
    idempotencyKey: undefined,
  })).digest("hex");
}

function orderRef(reference: string) { return storeDb().collection("orders").doc(reference); }
function checkoutKeyRef(key: string) { return storeDb().collection("checkoutKeys").doc(createHash("sha256").update(key).digest("hex")); }
function recordEvent(tx: FirebaseFirestore.Transaction, order: Order, action: string, previousStatus: OrderStatus, providerStatus: string | null = null) {
  tx.create(storeDb().collection("paymentEvents").doc(`${order.reference}-${action}`), {
    reference: order.reference, action, previousStatus, nextStatus: order.status,
    providerStatus, amountMinor: order.totalMinor, currency: order.currency,
    at: order.updatedAt,
  });
}

function checkedTotal(lines: OrderLine[], zone: DeliveryZone): { subtotalMinor: number; totalMinor: number } {
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const totalMinor = subtotalMinor + zone.feeMinor;
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 10 || totalMinor > 10_000_000_00) {
    throw new HttpError(400, "Order amount is outside the supported range");
  }
  return { subtotalMinor, totalMinor };
}

export async function reserveOrder(input: CheckoutInput, config: CheckoutConfig): Promise<{ order: Order; created: boolean }> {
  const zone = matchingDeliveryZone(config, input.delivery.zoneId, input.delivery.region, input.delivery.city);
  if (!zone) throw new HttpError(400, "Delivery destination is not available");
  const fingerprint = checkoutFingerprint(input);
  const keyRef = checkoutKeyRef(input.idempotencyKey);
  const reference = `VG-${randomUUID().replace(/-/g, "")}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
  const productSlugs = [...new Set(input.items.map((item) => item.slug))];
  const refs = productSlugs.map((slug) => storeDb().collection("products").doc(slug));
  return storeDb().runTransaction(async (tx) => {
    const keySnap = await tx.get(keyRef);
    if (keySnap.exists) {
      const data = keySnap.data() as { reference: string; fingerprint: string };
      if (data.fingerprint !== fingerprint) throw new HttpError(409, "Checkout key was already used for a different bag");
      const existing = await tx.get(orderRef(data.reference));
      if (!existing.exists) throw new HttpError(500, "Checkout record is incomplete");
      return { order: existing.data() as Order, created: false };
    }
    const snapshots = await tx.getAll(...refs);
    const records = new Map<string, StoredProduct>();
    for (let index = 0; index < productSlugs.length; index++) {
      const record = readStoredProduct(snapshots[index].data());
      if (!record || record.status !== "published" || record.priceMinor === null) {
        throw new HttpError(409, "An item in your bag is no longer available");
      }
      records.set(productSlugs[index], record);
    }
    const lines: OrderLine[] = [];
    for (const item of input.items) {
      const product = records.get(item.slug)!;
      const variant = product.variants.find((candidate) => candidate.id === item.variantId);
      if (!variant || variant.stock - variant.reserved < item.quantity) {
        throw new HttpError(409, `${product.name} is no longer available in the selected size`);
      }
      const lineTotalMinor = product.priceMinor! * item.quantity;
      lines.push({ ...item, name: product.name, size: variant.size, sku: variant.sku,
        unitPriceMinor: product.priceMinor!, lineTotalMinor });
      variant.reserved += item.quantity;
    }
    const { subtotalMinor, totalMinor } = checkedTotal(lines, zone);
    const order: Order = { reference, fingerprint, status: "initializing", email: input.email,
      customer: input.customer,
      delivery: { ...input.delivery, zoneLabel: zone.label, feeMinor: zone.feeMinor },
      lines, subtotalMinor, deliveryFeeMinor: zone.feeMinor, totalMinor, currency: "GHS",
      authorizationUrl: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
      reservationExpiresAt: expiresAt, paymentStatus: null, paidAt: null };
    for (const [slug, record] of records) tx.set(storeDb().collection("products").doc(slug), record);
    tx.create(orderRef(reference), order);
    tx.create(keyRef, { reference, fingerprint, createdAt: now.toISOString() });
    recordEvent(tx, order, "reserved", "initializing");
    return { order, created: true };
  });
}

export async function markOrderInitialized(reference: string, authorizationUrl: string): Promise<Order> {
  const ref = orderRef(reference);
  return storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status !== "initializing") return order;
    const next: Order = { ...order, status: "pending_payment", authorizationUrl, updatedAt: new Date().toISOString() };
    tx.set(ref, next);
    recordEvent(tx, next, "initialized", order.status);
    return next;
  });
}

type Settlement = "capture" | "release";

async function settleReservation(tx: FirebaseFirestore.Transaction, order: Order, mode: Settlement): Promise<boolean> {
  const slugs = [...new Set(order.lines.map((line) => line.slug))];
  const refs = slugs.map((slug) => storeDb().collection("products").doc(slug));
  const snaps = await tx.getAll(...refs);
  const records = new Map<string, StoredProduct>();
  for (let index = 0; index < slugs.length; index++) {
    const record = readStoredProduct(snaps[index].data());
    if (!record) return false;
    records.set(slugs[index], record);
  }
  for (const line of order.lines) {
    const variant = records.get(line.slug)?.variants.find((item) => item.id === line.variantId);
    if (!variant || variant.reserved < line.quantity || (mode === "capture" && variant.stock < line.quantity)) return false;
    variant.reserved -= line.quantity;
    if (mode === "capture") variant.stock -= line.quantity;
  }
  for (const [slug, record] of records) tx.set(storeDb().collection("products").doc(slug), record);
  return true;
}

export async function failInitialization(reference: string): Promise<void> {
  const ref = orderRef(reference);
  await storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order || order.status !== "initializing") return;
    if (!await settleReservation(tx, order, "release")) throw new HttpError(500, "Unable to release reserved stock");
    const next: Order = { ...order, status: "failed", paymentStatus: "initialization_failed", updatedAt: new Date().toISOString() };
    tx.set(ref, next);
    recordEvent(tx, next, "initialization_failed", order.status, "initialization_failed");
  });
}

export async function getOrder(reference: string): Promise<Order | null> {
  if (!/^VG-[0-9a-f]{32}$/.test(reference)) return null;
  const snap = await orderRef(reference).get();
  return (snap.data() as Order | undefined) ?? null;
}

export async function listAdminOrders(): Promise<Order[]> {
  const snap = await storeDb().collection("orders").orderBy("createdAt", "desc").limit(201).get();
  if (snap.size > 200) throw new HttpError(503, "Order admin needs pagination before processing more orders");
  return snap.docs.map((doc) => doc.data() as Order);
}

export async function reconcilePayment(verification: PaystackVerification): Promise<Order | null> {
  const ref = orderRef(verification.reference);
  return storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order) return null;
    const now = new Date().toISOString();
    const action = paymentAction(order, verification, now);
    if (action === "keep") return order;
    if (action === "reverse_review") {
      const next: Order = { ...order, status: "review_required", paymentStatus: "reversed", updatedAt: now };
      tx.set(ref, next);
      recordEvent(tx, next, "reversed_review", order.status, verification.status);
      return next;
    }
    if (action === "release_review") {
      if (!await settleReservation(tx, order, "release")) throw new HttpError(500, "Unable to release reserved stock");
      const next: Order = { ...order, status: "review_required", paymentStatus: "success", updatedAt: now };
      tx.set(ref, next);
      recordEvent(tx, next, "payment_review", order.status, verification.status);
      return next;
    }
    if (action === "review") {
      const next: Order = { ...order, status: "review_required", paymentStatus: "success", updatedAt: now };
      tx.set(ref, next);
      recordEvent(tx, next, "payment_review", order.status, verification.status);
      return next;
    }
    if (action === "capture") {
      if (!await settleReservation(tx, order, "capture")) {
        const next: Order = { ...order, status: "review_required", paymentStatus: "success", updatedAt: now };
        tx.set(ref, next);
        recordEvent(tx, next, "payment_review", order.status, verification.status);
        return next;
      }
      const next: Order = { ...order, status: "paid", paymentStatus: "success", paidAt: now, updatedAt: now };
      tx.set(ref, next);
      recordEvent(tx, next, "payment_paid", order.status, verification.status);
      return next;
    }
    if (action === "release_failed") {
      if (!await settleReservation(tx, order, "release")) throw new HttpError(500, "Unable to release reserved stock");
      const next: Order = { ...order, status: "failed", paymentStatus: verification.status, updatedAt: now };
      tx.set(ref, next);
      recordEvent(tx, next, "payment_failed", order.status, verification.status);
      return next;
    }
    return order;
  });
}

export async function expireReservations(limit = 50): Promise<number> {
  const now = new Date().toISOString();
  const snap = await storeDb().collection("orders")
    .where("status", "in", ["initializing", "pending_payment"])
    .where("reservationExpiresAt", "<=", now)
    .limit(limit).get();
  let expired = 0;
  for (const doc of snap.docs) {
    const before = doc.data() as Order;
    if (before.status === "pending_payment") {
      const verification = await verifyPaystack(before.reference, paymentConfig().secretKey);
      if (verification.reference !== before.reference) throw new HttpError(502, "Payment reference mismatch during expiry check");
      if (["success", "failed", "abandoned", "reversed"].includes(verification.status)) {
        await reconcilePayment(verification);
        continue;
      }
    }
    const didExpire = await storeDb().runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      const order = fresh.data() as Order | undefined;
      if (!order || !["initializing", "pending_payment"].includes(order.status) || order.reservationExpiresAt > now) return false;
      if (!await settleReservation(tx, order, "release")) throw new HttpError(500, "Unable to release reserved stock");
      const next: Order = { ...order, status: "expired", updatedAt: now };
      tx.set(doc.ref, next);
      recordEvent(tx, next, "reservation_expired", order.status);
      return true;
    });
    if (didExpire) expired++;
  }
  return expired;
}
