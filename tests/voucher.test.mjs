import test from "node:test";
import assert from "node:assert/strict";
import {
  codeFromBytes, computeDiscount, defaultVoucherSettings, effectiveMaxPercent, formatVoucherCode, hardMaxPercent,
  normalizeVoucherCode, parseVoucherCreate, parseVoucherSettings, parseVoucherUpdate, VoucherInputError, voucherMessage,
  voucherProblem, voucherState,
} from "../src/lib/voucher.ts";

const now = new Date("2026-11-08T10:00:00.000Z");
const settings = { enabled: true, maxPercent: 30 };
const base = { label: "Ama, Instagram", percentOff: 10, expiresAt: "2026-12-31" };

function voucher(patch = {}) {
  return {
    code: "7K2M9QXA4BCD", label: "x", percentOff: 10, maxUses: 1, perCustomerLimit: 1, startsAt: null,
    expiresAt: "2026-12-31T23:59:59.999Z", minSubtotalMinor: 0, maxDiscountMinor: null, active: true,
    reserved: 0, redeemed: 0, createdAt: "2026-11-01T00:00:00.000Z", createdBy: "admin", updatedAt: "2026-11-01T00:00:00.000Z", ...patch,
  };
}
const context = (patch = {}) => ({ now: "2026-11-08T10:00:00.000Z", subtotalMinor: 20000, customerUses: 0, settings, ...patch });

test("codes are 12 characters, easy to type and hard to misread", () => {
  const code = codeFromBytes(Uint8Array.from({ length: 12 }, (_, index) => index * 21));
  assert.equal(code.length, 12);
  assert.equal(normalizeVoucherCode(formatVoucherCode(code)), code);
  assert.equal(formatVoucherCode("7K2M9QXA4BCD"), "7K2M-9QXA-4BCD");
  for (const typed of ["7k2m-9qxa-4bcd", " 7K2M 9QXA 4BCD ", "7K2M9QXA4BCD"]) assert.equal(normalizeVoucherCode(typed), "7K2M9QXA4BCD", typed);
  // O reads as 0 and I or L read as 1, like order numbers.
  assert.equal(normalizeVoucherCode("OOOO-IIII-LLLL"), "000011111111");
  for (const bad of ["", "SHORT", "7K2M-9QXA-4BC", "7K2M-9QXA-4BCDE", "WELCOME10", "7K2M-9QXA-4BCU", null, 5, "7K2M-9QXA-4BC!", "A".repeat(100)]) {
    assert.equal(normalizeVoucherCode(bad), null, String(bad));
  }
  assert.throws(() => codeFromBytes(new Uint8Array(5)));
});

test("a new voucher needs a note, a sensible percentage and a future last day", () => {
  const made = parseVoucherCreate(base, settings, now);
  assert.deepEqual(made, { label: "Ama, Instagram", percentOff: 10, quantity: 1, maxUses: 1, perCustomerLimit: 1, startsAt: null,
    expiresAt: "2026-12-31T23:59:59.999Z", minSubtotalMinor: 0, maxDiscountMinor: null });
  const full = parseVoucherCreate({ ...base, quantity: 20, maxUses: 5, perCustomerLimit: 2, startsAt: "2026-11-10", minSubtotalMinor: 15000, maxDiscountMinor: 5000 }, settings, now);
  assert.equal(full.startsAt, "2026-11-10T00:00:00.000Z");
  assert.equal(full.quantity, 20);
  assert.equal(full.maxDiscountMinor, 5000);
  const bad = [
    {}, { ...base, label: "" }, { ...base, label: "x".repeat(81) }, { ...base, label: "<b>hi</b>" }, { ...base, label: 5 },
    { ...base, percentOff: 0 }, { ...base, percentOff: 31 }, { ...base, percentOff: 10.5 }, { ...base, percentOff: "10" }, { ...base, percentOff: 100 },
    { ...base, quantity: 0 }, { ...base, quantity: 51 }, { ...base, maxUses: 0 }, { ...base, maxUses: 2, perCustomerLimit: 3 },
    { ...base, expiresAt: "2026-11-07" }, { ...base, expiresAt: "2028-01-01" }, { ...base, expiresAt: "soon" }, { ...base, expiresAt: undefined },
    { ...base, startsAt: "2027-01-01" }, { ...base, startsAt: "nonsense" },
    { ...base, minSubtotalMinor: -1 }, { ...base, maxDiscountMinor: 0 }, { ...base, code: "WELCOME10" }, { ...base, active: true }, null, [], "x",
  ];
  for (const value of bad) assert.throws(() => parseVoucherCreate(value, settings, now), VoucherInputError, JSON.stringify(value));
});

test("the percentage ceiling comes from settings but can never pass the hard limit", () => {
  assert.equal(effectiveMaxPercent({ enabled: true, maxPercent: 20 }), 20);
  assert.equal(effectiveMaxPercent({ enabled: true, maxPercent: 99 }), hardMaxPercent);
  assert.throws(() => parseVoucherCreate({ ...base, percentOff: 25 }, { enabled: true, maxPercent: 20 }, now), VoucherInputError);
  assert.throws(() => parseVoucherCreate({ ...base, percentOff: 51 }, { enabled: true, maxPercent: 99 }, now), VoucherInputError);
  assert.equal(parseVoucherCreate({ ...base, percentOff: 50 }, { enabled: true, maxPercent: 99 }, now).percentOff, 50);
});

test("settings must be explicit and capped", () => {
  assert.deepEqual(parseVoucherSettings({ enabled: true, maxPercent: 25 }), { enabled: true, maxPercent: 25 });
  for (const bad of [{}, { enabled: "yes", maxPercent: 10 }, { enabled: true }, { enabled: true, maxPercent: 0 }, { enabled: true, maxPercent: 51 },
    { enabled: true, maxPercent: 10, extra: 1 }, null]) {
    assert.throws(() => parseVoucherSettings(bad), VoucherInputError, JSON.stringify(bad));
  }
  assert.equal(defaultVoucherSettings.enabled, false);
});

test("an existing voucher can be switched off, relabelled or extended, but its percentage can never change", () => {
  const current = { reserved: 1, redeemed: 2, perCustomerLimit: 1 };
  assert.deepEqual(parseVoucherUpdate({ active: false }, current, now), { active: false });
  assert.deepEqual(parseVoucherUpdate({ label: "New note", expiresAt: "2027-01-31" }, current, now), { label: "New note", expiresAt: "2027-01-31T23:59:59.999Z" });
  assert.deepEqual(parseVoucherUpdate({ maxUses: 3 }, current, now), { maxUses: 3 });
  for (const bad of [{ percentOff: 50 }, { code: "x" }, { reserved: 0 }, { redeemed: 0 }, { maxUses: 2 }, { maxUses: 0 }, { active: "no" },
    { expiresAt: "2030-01-01" }, {}, null]) {
    assert.throws(() => parseVoucherUpdate(bad, current, now), VoucherInputError, JSON.stringify(bad));
  }
  try { parseVoucherUpdate({ percentOff: 50 }, current, now); } catch (error) { assert.match(error.message, /cannot be changed/); }
});

test("a voucher works only while every rule allows it", () => {
  assert.equal(voucherProblem(voucher(), context()), null);
  const unavailable = { reason: "unavailable" };
  assert.deepEqual(voucherProblem(null, context()), unavailable);
  assert.deepEqual(voucherProblem(voucher(), context({ settings: { enabled: false, maxPercent: 30 } })), unavailable);
  assert.deepEqual(voucherProblem(voucher({ active: false }), context()), unavailable);
  assert.deepEqual(voucherProblem(voucher({ startsAt: "2026-11-09T00:00:00.000Z" }), context()), unavailable);
  assert.deepEqual(voucherProblem(voucher({ expiresAt: "2026-11-08T09:59:59.999Z" }), context()), unavailable);
  assert.deepEqual(voucherProblem(voucher({ maxUses: 2, reserved: 1, redeemed: 1 }), context()), unavailable);
  // Lowering the ceiling in settings stops vouchers above it from working.
  assert.deepEqual(voucherProblem(voucher({ percentOff: 40 }), context()), unavailable);
  assert.equal(voucherProblem(voucher({ maxUses: 3, reserved: 1, redeemed: 1 }), context()), null);
  assert.deepEqual(voucherProblem(voucher({ minSubtotalMinor: 30000 }), context()), { reason: "minimum", minSubtotalMinor: 30000 });
  assert.equal(voucherProblem(voucher({ minSubtotalMinor: 20000 }), context()), null);
  assert.deepEqual(voucherProblem(voucher({ perCustomerLimit: 1 }), context({ customerUses: 1 })), { reason: "customer" });
  assert.equal(voucherProblem(voucher({ maxUses: 5, perCustomerLimit: 2 }), context({ customerUses: 1 })), null);
});

test("customers see the same message for every reason that could reveal a code", () => {
  const money = (minor) => `GH₵${(minor / 100).toFixed(2)}`;
  assert.equal(voucherMessage({ reason: "unavailable" }, money), "This voucher cannot be used. Check the code and try again.");
  assert.match(voucherMessage({ reason: "minimum", minSubtotalMinor: 30000 }, money), /GH₵300\.00/);
  assert.match(voucherMessage({ reason: "customer" }, money), /phone number/);
});

test("the discount is whole pesewas, rounded down, capped, and never the whole price", () => {
  assert.equal(computeDiscount(25000, 10, null), 2500);
  assert.equal(computeDiscount(999, 10, null), 99);
  assert.equal(computeDiscount(25000, 10, 1000), 1000);
  assert.equal(computeDiscount(25000, 50, null), 12500);
  assert.equal(computeDiscount(1, 50, null), 0);
  assert.equal(computeDiscount(0, 10, null), 0);
  assert.equal(computeDiscount(-5, 10, null), 0);
  assert.equal(computeDiscount(100, 100, null), 99);
  assert.equal(computeDiscount(Number.NaN, 10, null), 0);
});

test("the admin sees one clear state per voucher", () => {
  const at = "2026-11-08T10:00:00.000Z";
  assert.equal(voucherState(voucher(), at), "active");
  assert.equal(voucherState(voucher({ active: false }), at), "off");
  assert.equal(voucherState(voucher({ expiresAt: "2026-11-01T00:00:00.000Z" }), at), "expired");
  assert.equal(voucherState(voucher({ redeemed: 1 }), at), "used_up");
  assert.equal(voucherState(voucher({ startsAt: "2026-11-20T00:00:00.000Z" }), at), "waiting");
});
