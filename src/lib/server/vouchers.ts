import "server-only";

import { randomBytes } from "node:crypto";
import { phoneKey } from "../contact";
import {
  codeFromBytes, computeDiscount, defaultVoucherSettings, maxVouchersTotal, normalizeVoucherCode, parseVoucherCreate,
  parseVoucherSettings, parseVoucherUpdate, VoucherInputError, voucherMessage, voucherProblem,
  type Voucher, type VoucherSettings,
} from "../voucher";
import { storeDb } from "./firebase-admin";
import { HttpError } from "./http";

const vouchers = () => storeDb().collection("vouchers");
const settingsRef = () => storeDb().collection("settings").doc("vouchers");

export const voucherRef = (code: string) => vouchers().doc(code);
/** How many uses one phone number holds on one voucher. */
export const voucherCustomerRef = (code: string, phone: string) => vouchers().doc(code).collection("customers").doc(phoneKey(phone) ?? "none");
export const voucherEventRef = (id?: string) => id ? storeDb().collection("voucherEvents").doc(id) : storeDb().collection("voucherEvents").doc();

export const formatMinor = (minor: number) => `GH₵${(minor / 100).toFixed(2)}`;

/** Maps the pure parsers' errors to a 400. */
function bad<T>(run: () => T): T {
  try { return run(); } catch (error) {
    if (error instanceof VoucherInputError) throw new HttpError(400, error.message);
    throw error;
  }
}

/** Reads a stored voucher defensively: a malformed record is treated as no voucher. */
export function readVoucher(data: FirebaseFirestore.DocumentData | undefined): Voucher | null {
  if (!data || typeof data.code !== "string" || normalizeVoucherCode(data.code) !== data.code) return null;
  const numbers = ["percentOff", "maxUses", "perCustomerLimit", "minSubtotalMinor", "reserved", "redeemed"];
  if (numbers.some((key) => !Number.isSafeInteger(data[key]))) return null;
  if (typeof data.expiresAt !== "string" || typeof data.active !== "boolean") return null;
  return {
    code: data.code, label: String(data.label ?? ""), percentOff: data.percentOff, maxUses: data.maxUses,
    perCustomerLimit: data.perCustomerLimit, startsAt: typeof data.startsAt === "string" ? data.startsAt : null,
    expiresAt: data.expiresAt, minSubtotalMinor: data.minSubtotalMinor,
    maxDiscountMinor: Number.isSafeInteger(data.maxDiscountMinor) ? data.maxDiscountMinor : null,
    active: data.active, reserved: data.reserved, redeemed: data.redeemed,
    createdAt: String(data.createdAt ?? ""), createdBy: String(data.createdBy ?? ""), updatedAt: String(data.updatedAt ?? ""),
  };
}

export function readVoucherSettings(data: FirebaseFirestore.DocumentData | undefined): VoucherSettings {
  if (!data || typeof data.enabled !== "boolean" || !Number.isSafeInteger(data.maxPercent)) return { ...defaultVoucherSettings };
  return { enabled: data.enabled, maxPercent: data.maxPercent };
}

// Short cache so the checkout page does not read settings on every visit. Saving
// settings clears it on the instance that handled the save; others catch up in 30 s.
const cache = globalThis as unknown as { __vegoraVoucherSettings?: { at: number; value: VoucherSettings } };

export async function getVoucherSettings(fresh = false): Promise<VoucherSettings> {
  const hit = cache.__vegoraVoucherSettings;
  if (!fresh && hit && Date.now() - hit.at < 30_000) return hit.value;
  const value = readVoucherSettings((await settingsRef().get()).data());
  cache.__vegoraVoucherSettings = { at: Date.now(), value };
  return value;
}

export async function saveVoucherSettings(input: unknown, actorUid: string): Promise<VoucherSettings> {
  const settings = bad(() => parseVoucherSettings(input));
  const now = new Date().toISOString();
  const batch = storeDb().batch();
  batch.set(settingsRef(), { ...settings, updatedAt: now, updatedBy: actorUid });
  batch.create(voucherEventRef(), { action: "settings", enabled: settings.enabled, maxPercent: settings.maxPercent, actor: actorUid, at: now });
  await batch.commit();
  cache.__vegoraVoucherSettings = { at: Date.now(), value: settings };
  return settings;
}

export async function listVouchers(): Promise<{ vouchers: Voucher[]; truncated: boolean }> {
  const snap = await vouchers().orderBy("createdAt", "desc").limit(501).get();
  const list = snap.docs.slice(0, 500).map((doc) => readVoucher(doc.data())).filter((item): item is Voucher => item !== null);
  return { vouchers: list, truncated: snap.size > 500 };
}

export async function createVouchers(input: unknown, actorUid: string): Promise<Voucher[]> {
  const settings = await getVoucherSettings(true);
  const parsed = bad(() => parseVoucherCreate(input, settings));
  const total = (await vouchers().count().get()).data().count;
  if (total + parsed.quantity > maxVouchersTotal) {
    throw new HttpError(409, `You can keep at most ${maxVouchersTotal} vouchers. Delete unused ones first.`);
  }
  const now = new Date().toISOString();
  const created: Voucher[] = [];
  const batch = storeDb().batch();
  const seen = new Set<string>();
  while (created.length < parsed.quantity) {
    const code = codeFromBytes(randomBytes(12));
    if (seen.has(code)) continue;
    seen.add(code);
    const voucher: Voucher = {
      code, label: parsed.label, percentOff: parsed.percentOff, maxUses: parsed.maxUses, perCustomerLimit: parsed.perCustomerLimit,
      startsAt: parsed.startsAt, expiresAt: parsed.expiresAt, minSubtotalMinor: parsed.minSubtotalMinor,
      maxDiscountMinor: parsed.maxDiscountMinor, active: true, reserved: 0, redeemed: 0,
      createdAt: now, createdBy: actorUid, updatedAt: now,
    };
    // create() fails if the code already exists, so a clash can never overwrite a voucher.
    batch.create(voucherRef(code), voucher);
    batch.create(voucherEventRef(), { code, action: "created", percentOff: voucher.percentOff, actor: actorUid, at: now });
    created.push(voucher);
  }
  await batch.commit();
  return created;
}

export async function updateVoucher(rawCode: string, input: unknown, actorUid: string): Promise<Voucher> {
  const code = normalizeVoucherCode(rawCode);
  if (!code) throw new HttpError(404, "Voucher not found");
  return storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(voucherRef(code));
    const current = readVoucher(snap.data());
    if (!current) throw new HttpError(404, "Voucher not found");
    const update = bad(() => parseVoucherUpdate(input, current));
    const now = new Date().toISOString();
    const next: Voucher = { ...current, ...update, updatedAt: now };
    tx.set(voucherRef(code), next);
    tx.create(voucherEventRef(), { code, action: "updated", changes: Object.keys(update), actor: actorUid, at: now });
    return next;
  });
}

export async function deleteVoucher(rawCode: string, actorUid: string): Promise<void> {
  const code = normalizeVoucherCode(rawCode);
  if (!code) throw new HttpError(404, "Voucher not found");
  await storeDb().runTransaction(async (tx) => {
    const snap = await tx.get(voucherRef(code));
    const current = readVoucher(snap.data());
    if (!current) throw new HttpError(404, "Voucher not found");
    if (current.reserved + current.redeemed > 0) throw new HttpError(409, "This voucher has been used. Turn it off instead of deleting it.");
    tx.delete(voucherRef(code));
    tx.create(voucherEventRef(), { code, action: "deleted", actor: actorUid, at: new Date().toISOString() });
  });
}

/** A preview for the checkout page. The real decision is made again, inside the order transaction. */
export async function quoteVoucher(rawCode: unknown, subtotalMinor: number): Promise<{ code: string; percentOff: number; discountMinor: number }> {
  const unavailable = new HttpError(400, voucherMessage({ reason: "unavailable" }, formatMinor));
  const code = normalizeVoucherCode(rawCode);
  if (!code) throw unavailable;
  const [settings, snap] = await Promise.all([getVoucherSettings(), voucherRef(code).get()]);
  const voucher = readVoucher(snap.data());
  const problem = voucherProblem(voucher, { now: new Date().toISOString(), subtotalMinor, customerUses: 0, settings });
  if (problem) throw new HttpError(400, voucherMessage(problem, formatMinor));
  const discountMinor = computeDiscount(subtotalMinor, voucher!.percentOff, voucher!.maxDiscountMinor);
  if (discountMinor <= 0) throw unavailable;
  return { code, percentOff: voucher!.percentOff, discountMinor };
}
