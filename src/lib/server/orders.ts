import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { CheckoutConfig, DeliveryZone } from "./checkout-config";
import { storeDb } from "./firebase-admin";
import { HttpError } from "./http";
import { readStoredProduct, type StoredProduct } from "./products";
import type { PaystackVerification } from "./paystack";
import { paymentAction, type OrderStatus } from "./payment-policy";
import { paymentConfig } from "./checkout-config";
import { verifyPaystack } from "./paystack";
import { placeholderEmail } from "../contact";
import { computeDiscount, normalizeVoucherCode, voucherMessage, voucherProblem } from "../voucher";
import { formatMinor, readVoucher, readVoucherSettings, voucherCustomerRef, voucherEventRef, voucherRef } from "./vouchers";
import { emptyFulfillment, FulfillmentInputError, fulfillmentTransition, parseFulfillmentInput, shortOrderCode,
  trackingLookupMatches, type TrackingLookup, type Fulfillment, type FulfillmentEvent, type FulfillmentEventKind, type FulfillmentInput,
  type FulfillmentStatus } from "../fulfillment";

export type { OrderStatus } from "./payment-policy";

export interface CheckoutItem { slug: string; variantId: string; quantity: number }
export interface CheckoutInput {
  email: string;
  customer: { name: string; phone: string };
  delivery: { zoneId: string; addressLine1: string; addressLine2: string; city: string; region: string; notes: string };
  items: CheckoutItem[];
  idempotencyKey: string;
  /** Normalised voucher code, or null. Only the code is accepted from the browser; the server works out the rest. */
  voucherCode: string | null;
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
  /** Taken off the clothes by a voucher (0 when none). totalMinor = subtotal - discount + delivery. */
  discountMinor?: number;
  voucher?: { code: string; percentOff: number; label: string } | null;
  deliveryFeeMinor: number;
  totalMinor: number;
  currency: "GHS";
  authorizationUrl: string | null;
  createdAt: string;
  updatedAt: string;
  reservationExpiresAt: string;
  paymentStatus: string | null;
  paidAt: string | null;
  fulfillment?: Fulfillment;
  /** Short order number shown to customers, derived from the reference. */
  shortCode?: string;
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

export function parseCartItems(value: unknown): CheckoutItem[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) {
    throw new HttpError(400, "Choose 1–30 items");
  }
  const items = value.map((line) => {
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
    throw new HttpError(400, "The same size is in your cart twice");
  }
  return items;
}

/** The price of the clothes in a cart, worked out from the catalogue. Used to preview a voucher. */
export async function quoteClothes(items: CheckoutItem[]): Promise<number> {
  const slugs = [...new Set(items.map((item) => item.slug))];
  const snaps = await storeDb().getAll(...slugs.map((slug) => storeDb().collection("products").doc(slug)));
  const records = new Map<string, StoredProduct>();
  slugs.forEach((slug, index) => {
    const record = readStoredProduct(snaps[index].data());
    if (!record || record.status !== "published" || record.priceMinor === null) throw new HttpError(409, "An item in your cart is no longer available");
    records.set(slug, record);
  });
  return items.reduce((sum, item) => {
    const product = records.get(item.slug)!;
    if (!product.variants.some((variant) => variant.id === item.variantId)) throw new HttpError(409, `${product.name} is no longer available in the selected size`);
    return sum + product.priceMinor! * item.quantity;
  }, 0);
}

export function parseCheckoutInput(value: unknown): CheckoutInput {
  const input = object(value);
  const customer = object(input.customer);
  const name = boundedText(customer.name, "Name", 150);
  const phone = boundedText(customer.phone, "Phone number", 30);
  if (!/^[+0-9()\s-]{8,30}$/.test(phone)) throw new HttpError(400, "Enter a valid phone number");
  // No email is collected. Paystack still needs one to start a payment, so the order
  // carries a private placeholder made from the phone number.
  const email = placeholderEmail(phone);
  if (!email) throw new HttpError(400, "Enter a valid phone number");
  const delivery = object(input.delivery);
  const zoneId = boundedText(delivery.zoneId, "Delivery area", 50);
  const addressLine1 = boundedText(delivery.addressLine1, "Delivery address", 300);
  // The area (and its region) comes from the delivery zone, not from the customer.
  const addressLine2 = "";
  const city = "";
  const region = "";
  const notes = "";
  const items = parseCartItems(input.items);
  let voucherCode: string | null = null;
  if (input.voucherCode !== undefined && input.voucherCode !== null && input.voucherCode !== "") {
    voucherCode = normalizeVoucherCode(input.voucherCode);
    if (!voucherCode) throw new HttpError(400, voucherMessage({ reason: "unavailable" }, formatMinor));
  }
  const idempotencyKey = boundedText(input.idempotencyKey, "Checkout key", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    throw new HttpError(400, "Checkout key must be a random UUID");
  }
  return { email, customer: { name, phone },
    delivery: { zoneId, addressLine1, addressLine2, city, region, notes },
    items, idempotencyKey: idempotencyKey.toLowerCase(), voucherCode };
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

function checkedTotal(lines: OrderLine[], zone: DeliveryZone, discountMinor: number): { subtotalMinor: number; totalMinor: number } {
  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const totalMinor = subtotalMinor - discountMinor + zone.feeMinor;
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 10 || totalMinor > 10_000_000_00) {
    throw new HttpError(400, "Order amount is outside the supported range");
  }
  return { subtotalMinor, totalMinor };
}

export async function reserveOrder(input: CheckoutInput, config: CheckoutConfig): Promise<{ order: Order; created: boolean }> {
  const zone = config.zones.find((entry) => entry.id === input.delivery.zoneId);
  if (!zone) throw new HttpError(400, "Please choose Accra or Tema for delivery");
  input = { ...input, delivery: { ...input.delivery, region: zone.region, city: zone.cities?.[0] ?? zone.label } };
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
      if (data.fingerprint !== fingerprint) throw new HttpError(409, "Checkout key was already used for a different cart");
      const existing = await tx.get(orderRef(data.reference));
      if (!existing.exists) throw new HttpError(500, "Checkout record is incomplete");
      return { order: existing.data() as Order, created: false };
    }
    const snapshots = await tx.getAll(...refs);
    const records = new Map<string, StoredProduct>();
    for (let index = 0; index < productSlugs.length; index++) {
      const record = readStoredProduct(snapshots[index].data());
      if (!record || record.status !== "published" || record.priceMinor === null) {
        throw new HttpError(409, "An item in your cart is no longer available");
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
    const clothesMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
    // Voucher: every rule is checked here, in the same transaction that holds the stock,
    // so two people can never both take the last use of a voucher.
    let discountMinor = 0;
    let voucherUse: { code: string; percentOff: number; label: string } | null = null;
    let voucherWrites: (() => void) | null = null;
    if (input.voucherCode) {
      const [voucherSnap, customerSnap, settingsSnap] = await Promise.all([
        tx.get(voucherRef(input.voucherCode)),
        tx.get(voucherCustomerRef(input.voucherCode, input.customer.phone)),
        tx.get(storeDb().collection("settings").doc("vouchers")),
      ]);
      const voucher = readVoucher(voucherSnap.data());
      const customerUses = Number(customerSnap.data()?.active ?? 0) || 0;
      const problem = voucherProblem(voucher, { now: now.toISOString(), subtotalMinor: clothesMinor, customerUses, settings: readVoucherSettings(settingsSnap.data()) });
      if (problem || !voucher) throw new HttpError(400, voucherMessage(problem ?? { reason: "unavailable" }, formatMinor));
      discountMinor = computeDiscount(clothesMinor, voucher.percentOff, voucher.maxDiscountMinor);
      if (discountMinor <= 0) throw new HttpError(400, voucherMessage({ reason: "unavailable" }, formatMinor));
      voucherUse = { code: voucher.code, percentOff: voucher.percentOff, label: voucher.label };
      voucherWrites = () => {
        tx.set(voucherRef(voucher.code), { ...voucher, reserved: voucher.reserved + 1, updatedAt: now.toISOString() });
        tx.set(voucherCustomerRef(voucher.code, input.customer.phone), { active: customerUses + 1, updatedAt: now.toISOString() });
        tx.set(voucherEventRef(`${voucher.code}-${reference}-reserved`), { code: voucher.code, action: "reserved", order: reference, discountMinor, at: now.toISOString() });
      };
    }
    const { subtotalMinor, totalMinor } = checkedTotal(lines, zone, discountMinor);
    const order: Order = { reference, fingerprint, status: "initializing", email: input.email,
      customer: input.customer,
      delivery: { ...input.delivery, zoneLabel: zone.label, feeMinor: zone.feeMinor },
      lines, subtotalMinor, discountMinor, voucher: voucherUse, deliveryFeeMinor: zone.feeMinor, totalMinor, currency: "GHS",
      authorizationUrl: null, createdAt: now.toISOString(), updatedAt: now.toISOString(),
      reservationExpiresAt: expiresAt, paymentStatus: null, paidAt: null,
      fulfillment: { ...emptyFulfillment }, shortCode: shortOrderCode(reference) ?? undefined };
    for (const [slug, record] of records) tx.set(storeDb().collection("products").doc(slug), record);
    voucherWrites?.();
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
  // A voucher use follows the stock: it becomes a redemption when payment is captured
  // and is given back when the order is released. Reads come first, writes at the end.
  const voucherCode = order.voucher?.code;
  const voucherSnap = voucherCode ? await tx.get(voucherRef(voucherCode)) : null;
  const customerSnap = voucherCode ? await tx.get(voucherCustomerRef(voucherCode, order.customer.phone)) : null;
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
  const voucher = readVoucher(voucherSnap?.data());
  if (voucherCode && voucher) {
    const at = new Date().toISOString();
    const reserved = Math.max(0, voucher.reserved - 1);
    if (mode === "capture") {
      tx.set(voucherRef(voucherCode), { ...voucher, reserved, redeemed: voucher.redeemed + 1, updatedAt: at });
    } else {
      tx.set(voucherRef(voucherCode), { ...voucher, reserved, updatedAt: at });
      const held = Number(customerSnap?.data()?.active ?? 0) || 0;
      tx.set(voucherCustomerRef(voucherCode, order.customer.phone), { active: Math.max(0, held - 1), updatedAt: at });
    }
    tx.set(voucherEventRef(`${voucherCode}-${order.reference}-${mode === "capture" ? "redeemed" : "released"}`),
      { code: voucherCode, action: mode === "capture" ? "redeemed" : "released", order: order.reference, at });
  }
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

/** Finds the order a customer is asking about by short number or long reference, if the phone number (or an older email) matches. */
export async function findOrderForTracking(lookup: TrackingLookup): Promise<Order | null> {
  if (lookup.reference) {
    const order = await getOrder(lookup.reference);
    return order && trackingLookupMatches(order, lookup) ? order : null;
  }
  if (!lookup.shortCode) return null;
  // Short numbers are not guaranteed unique, so check the phone number on every match.
  const snap = await storeDb().collection("orders").where("shortCode", "==", lookup.shortCode).limit(5).get();
  const match = snap.docs.map((doc) => doc.data() as Order).find((order) => trackingLookupMatches(order, lookup));
  return match ?? null;
}

export async function listAdminOrders(): Promise<{ orders: Order[]; truncated: boolean }> {
  const snap = await storeDb().collection("orders").orderBy("createdAt", "desc").limit(201).get();
  const orders = snap.docs.slice(0, 200).map((doc) => doc.data() as Order);
  return { orders, truncated: snap.size > 200 };
}

export async function updateOrderFulfillment(reference: string, value: unknown, actorUid: string): Promise<Order> {
  if (!/^VG-[0-9a-f]{32}$/.test(reference)) throw new HttpError(404, "Order not found");
  let input: FulfillmentInput;
  try {
    input = parseFulfillmentInput(value);
  } catch (error) {
    if (error instanceof FulfillmentInputError) throw new HttpError(400, error.message);
    throw error;
  }
  const { status, note } = input;
  const nextProvider = input.provider || null;
  const nextReference = input.trackingReference || null;
  const ref = orderRef(reference);
  return storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order) throw new HttpError(404, "Order not found");
    const current = order.fulfillment ?? emptyFulfillment;
    const kind = fulfillmentTransition(order.status, current.status, status);
    if (!kind) {
      throw new HttpError(409, "Delivery can change only after verified payment, one step at a time, and never after it is delivered");
    }
    const unchanged = current.status === status && current.provider === nextProvider &&
      current.trackingReference === nextReference;
    if (unchanged && !note) return order;
    const now = new Date().toISOString();
    const fulfillment: Fulfillment = { status, provider: nextProvider, trackingReference: nextReference, updatedAt: now };
    const next: Order = { ...order, fulfillment, updatedAt: now };
    tx.set(ref, next);
    tx.create(ref.collection("fulfillmentEvents").doc(), {
      status, provider: nextProvider, trackingReference: nextReference, at: now, kind, note: note || null, actorUid,
    });
    return next;
  });
}

export async function listFulfillmentEvents(reference: string): Promise<FulfillmentEvent[]> {
  if (!/^VG-[0-9a-f]{32}$/.test(reference)) return [];
  const snap = await orderRef(reference).collection("fulfillmentEvents").orderBy("at", "desc").limit(50).get();
  return snap.docs.map((doc) => {
    const event = doc.data();
    return { status: event.status as FulfillmentStatus, provider: event.provider ?? null,
      trackingReference: event.trackingReference ?? null, at: String(event.at),
      kind: (event.kind as FulfillmentEventKind | undefined) ?? "advance", note: event.note ?? null };
  }).reverse();
}

export async function reconcilePayment(verification: PaystackVerification): Promise<Order | null> {
  const ref = orderRef(verification.reference);
  return storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data() as Order | undefined;
    if (!order) return null;
    const now = new Date().toISOString();
    const action = paymentAction(order, verification, now, paymentConfig().mode);
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
