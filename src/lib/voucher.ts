// Voucher rules. Everything here is pure so the same code can be tested and
// reused by the server; the browser never decides whether a voucher is valid.

// Same alphabet as order numbers: no I, L, O or U, so a code is hard to misread.
const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const voucherCodeLength = 12;

/** No voucher may take off more than this, whatever the admin enters or settings say. */
export const hardMaxPercent = 50;
export const defaultMaxPercent = 30;
export const maxVoucherDays = 400;
export const maxVouchersTotal = 2000;
export const maxCreateAtOnce = 50;
const maxMoneyMinor = 10_000_000;

export interface VoucherSettings { enabled: boolean; maxPercent: number }
export const defaultVoucherSettings: VoucherSettings = { enabled: false, maxPercent: defaultMaxPercent };

export interface Voucher {
  /** Twelve characters without dashes. Also the document id. */
  code: string;
  /** Private note for the admin, for example who it was given to. Never shown to customers. */
  label: string;
  percentOff: number;
  maxUses: number;
  perCustomerLimit: number;
  startsAt: string | null;
  expiresAt: string;
  minSubtotalMinor: number;
  maxDiscountMinor: number | null;
  active: boolean;
  /** Uses held by orders that are still waiting for payment. */
  reserved: number;
  /** Uses on paid orders. */
  redeemed: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface VoucherCreateInput {
  label: string;
  percentOff: number;
  quantity: number;
  maxUses: number;
  perCustomerLimit: number;
  startsAt: string | null;
  expiresAt: string;
  minSubtotalMinor: number;
  maxDiscountMinor: number | null;
}

export type VoucherUpdateInput = Partial<Pick<Voucher, "active" | "expiresAt" | "label" | "maxUses">>;

/** Validation failures from the pure parsers; API routes map these to HTTP 400. */
export class VoucherInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoucherInputError";
  }
}

/** Accepts what a person might type: any case, spaces or dashes, O for 0, I or L for 1. */
export function normalizeVoucherCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 40) return null;
  const text = input.toUpperCase().replace(/[\s-]+/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (text.length !== voucherCodeLength) return null;
  for (const char of text) if (!alphabet.includes(char)) return null;
  return text;
}

export function formatVoucherCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

/** Builds a code from random bytes (one byte per character; 256 is a multiple of 32, so there is no bias). */
export function codeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < voucherCodeLength) throw new Error("Not enough random bytes");
  let code = "";
  for (let index = 0; index < voucherCodeLength; index += 1) code += alphabet[bytes[index] % 32];
  return code;
}

const noMarkup = /[<>\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/;

function integer(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new VoucherInputError(`${name} must be a whole number from ${min} to ${max}`);
  }
  return value;
}

function plainLabel(value: unknown): string {
  if (typeof value !== "string") throw new VoucherInputError("Add a short note so you remember who this voucher is for");
  const label = value.trim();
  if (!label || label.length > 80) throw new VoucherInputError("The note must be 1 to 80 characters");
  if (noMarkup.test(label)) throw new VoucherInputError("The note must be plain text");
  return label;
}

// A date picker sends YYYY-MM-DD. Ghana is on GMT, so a start is the beginning
// of that day and an end is the last moment of it.
function when(value: unknown, name: string, edge: "start" | "end"): string {
  if (typeof value !== "string") throw new VoucherInputError(`${name} is not a valid date`);
  const text = value.trim();
  const full = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z` : text;
  const time = Date.parse(full);
  if (Number.isNaN(time) || !/^\d{4}-\d{2}-\d{2}T/.test(full)) throw new VoucherInputError(`${name} is not a valid date`);
  return new Date(time).toISOString();
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new VoucherInputError("Invalid voucher details");
  return value as Record<string, unknown>;
}

function onlyKnown(input: Record<string, unknown>, known: string[]) {
  for (const key of Object.keys(input)) {
    if (!known.includes(key)) {
      throw new VoucherInputError(key === "percentOff" ? "The percentage cannot be changed. Turn this voucher off and make a new one" : `Unknown field: ${key}`);
    }
  }
}

export function effectiveMaxPercent(settings: VoucherSettings): number {
  return Math.min(hardMaxPercent, settings.maxPercent);
}

export function parseVoucherSettings(value: unknown): VoucherSettings {
  const input = record(value);
  onlyKnown(input, ["enabled", "maxPercent"]);
  if (typeof input.enabled !== "boolean") throw new VoucherInputError("Choose whether vouchers are on");
  return { enabled: input.enabled, maxPercent: integer(input.maxPercent, "The highest percentage", 1, hardMaxPercent) };
}

export function parseVoucherCreate(value: unknown, settings: VoucherSettings, now: Date = new Date()): VoucherCreateInput {
  const input = record(value);
  onlyKnown(input, ["label", "percentOff", "quantity", "maxUses", "perCustomerLimit", "startsAt", "expiresAt", "minSubtotalMinor", "maxDiscountMinor"]);
  const ceiling = effectiveMaxPercent(settings);
  const percentOff = integer(input.percentOff, "The percentage", 1, ceiling);
  const quantity = input.quantity === undefined ? 1 : integer(input.quantity, "How many vouchers", 1, maxCreateAtOnce);
  const maxUses = input.maxUses === undefined ? 1 : integer(input.maxUses, "Total uses", 1, 100_000);
  const perCustomerLimit = input.perCustomerLimit === undefined ? 1 : integer(input.perCustomerLimit, "Uses per phone number", 1, maxUses);
  const expiresAt = when(input.expiresAt, "The last day", "end");
  const startsAt = input.startsAt === undefined || input.startsAt === null || input.startsAt === "" ? null : when(input.startsAt, "The first day", "start");
  if (Date.parse(expiresAt) <= now.getTime()) throw new VoucherInputError("The last day must be in the future");
  if (Date.parse(expiresAt) > now.getTime() + maxVoucherDays * 86_400_000) throw new VoucherInputError(`A voucher can last at most ${maxVoucherDays} days`);
  if (startsAt && Date.parse(startsAt) >= Date.parse(expiresAt)) throw new VoucherInputError("The first day must be before the last day");
  const minSubtotalMinor = input.minSubtotalMinor === undefined ? 0 : integer(input.minSubtotalMinor, "The minimum spend", 0, maxMoneyMinor);
  const maxDiscountMinor = input.maxDiscountMinor === undefined || input.maxDiscountMinor === null ? null : integer(input.maxDiscountMinor, "The most it can take off", 1, maxMoneyMinor);
  return { label: plainLabel(input.label), percentOff, quantity, maxUses, perCustomerLimit, startsAt, expiresAt, minSubtotalMinor, maxDiscountMinor };
}

/** The percentage is deliberately not editable. Total uses can never drop below what has been used. */
export function parseVoucherUpdate(value: unknown, current: Pick<Voucher, "reserved" | "redeemed" | "perCustomerLimit">, now: Date = new Date()): VoucherUpdateInput {
  const input = record(value);
  onlyKnown(input, ["active", "expiresAt", "label", "maxUses"]);
  const update: VoucherUpdateInput = {};
  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") throw new VoucherInputError("Choose on or off");
    update.active = input.active;
  }
  if (input.label !== undefined) update.label = plainLabel(input.label);
  if (input.expiresAt !== undefined) {
    const expiresAt = when(input.expiresAt, "The last day", "end");
    if (Date.parse(expiresAt) > now.getTime() + maxVoucherDays * 86_400_000) throw new VoucherInputError(`A voucher can last at most ${maxVoucherDays} days`);
    update.expiresAt = expiresAt;
  }
  if (input.maxUses !== undefined) {
    const maxUses = integer(input.maxUses, "Total uses", Math.max(1, current.reserved + current.redeemed, current.perCustomerLimit), 100_000);
    update.maxUses = maxUses;
  }
  if (Object.keys(update).length === 0) throw new VoucherInputError("Nothing to change");
  return update;
}

export type VoucherProblem = { reason: "unavailable" } | { reason: "minimum"; minSubtotalMinor: number } | { reason: "customer" };

/**
 * Why a voucher cannot be used for this order, or null when it can.
 * "unavailable" covers every reason that could tell a stranger something about a
 * code (unknown, off, not started, expired, used up), so they all look the same.
 */
export function voucherProblem(
  voucher: Voucher | null,
  context: { now: string; subtotalMinor: number; customerUses: number; settings: VoucherSettings },
): VoucherProblem | null {
  const { now, subtotalMinor, customerUses, settings } = context;
  if (!voucher || !settings.enabled || !voucher.active) return { reason: "unavailable" };
  if (voucher.percentOff > effectiveMaxPercent(settings)) return { reason: "unavailable" };
  if (voucher.startsAt && now < voucher.startsAt) return { reason: "unavailable" };
  if (now > voucher.expiresAt) return { reason: "unavailable" };
  if (voucher.reserved + voucher.redeemed >= voucher.maxUses) return { reason: "unavailable" };
  if (subtotalMinor < voucher.minSubtotalMinor) return { reason: "minimum", minSubtotalMinor: voucher.minSubtotalMinor };
  if (customerUses >= voucher.perCustomerLimit) return { reason: "customer" };
  return null;
}

/** Whole pesewas, always rounded down, never more than the cap, never the whole price. */
export function computeDiscount(subtotalMinor: number, percentOff: number, maxDiscountMinor: number | null): number {
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor <= 0) return 0;
  let discount = Math.floor((subtotalMinor * percentOff) / 100);
  if (maxDiscountMinor !== null) discount = Math.min(discount, maxDiscountMinor);
  return Math.max(0, Math.min(discount, subtotalMinor - 1));
}

export function voucherMessage(problem: VoucherProblem, formatMoney: (minor: number) => string): string {
  if (problem.reason === "minimum") return `Spend at least ${formatMoney(problem.minSubtotalMinor)} on clothes to use this voucher.`;
  if (problem.reason === "customer") return "This voucher has already been used with this phone number.";
  return "This voucher cannot be used. Check the code and try again.";
}

/** The state shown to the admin. */
export function voucherState(voucher: Voucher, now: string): "active" | "used_up" | "expired" | "waiting" | "off" {
  if (!voucher.active) return "off";
  if (now > voucher.expiresAt) return "expired";
  if (voucher.reserved + voucher.redeemed >= voucher.maxUses) return "used_up";
  if (voucher.startsAt && now < voucher.startsAt) return "waiting";
  return "active";
}
