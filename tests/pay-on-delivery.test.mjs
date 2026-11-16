import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultCodSettings, DeliveryInputError, hardMaxCodMinor, parseCodSettings, parseDeliveryAreas, parseDeliverySettings,
} from "../src/lib/delivery.ts";
import { fulfillmentTransition, parseFulfillmentInput, publicTrackingView } from "../src/lib/fulfillment.ts";
import {
  canCancelCod, codHoldHours, codHoldUntil, codProblem, deliveryUnlocked, isCodOrder, needsPhoneConfirmation, parsePaymentMethod,
} from "../src/lib/payment-method.ts";

const accra = { id: "accra", label: "Accra", region: "Greater Accra", feeMinor: 3000, active: true, cod: false };
const tema = { id: "tema", label: "Tema", region: "Greater Accra", feeMinor: 5000, active: true, cod: false };
const current = { areas: [accra, tema], cod: { ...defaultCodSettings } };

test("pay on delivery starts OFF and nothing allows it by default", () => {
  assert.equal(defaultCodSettings.enabled, false);
  assert.match(codProblem(defaultCodSettings, { cod: true }, 10_000), /not available/);
});

test("the server rules: switch on, area allowed, amount within the limit", () => {
  const on = { enabled: true, maxOrderMinor: 50_000 };
  assert.equal(codProblem(on, { cod: true }, 50_000), null);
  assert.match(codProblem(on, { cod: false }, 10_000), /this area/);
  assert.match(codProblem(on, { cod: true }, 50_001), /up to GH₵500.00/);
});

test("the admin can switch it on per area and set a limit, but never above GH₵2,000", () => {
  const saved = parseDeliverySettings({ areas: [{ ...accra, cod: true }, tema], cod: { enabled: true, maxOrderMinor: 80_000 } }, current);
  assert.equal(saved.areas[0].cod, true);
  assert.equal(saved.areas[1].cod, false);
  assert.deepEqual(saved.cod, { enabled: true, maxOrderMinor: 80_000 });
  const reject = (cod, pattern) => assert.throws(() => parseCodSettings(cod, defaultCodSettings), (e) => e instanceof DeliveryInputError && pattern.test(e.message));
  reject({ maxOrderMinor: hardMaxCodMinor + 1 }, /cannot be more than GH₵2000/);
  reject({ maxOrderMinor: 999 }, /at least/);
  reject({ maxOrderMinor: 500.5 }, /cedis/);
  reject({ enabled: "yes" }, /on or off/);
  reject("on", /not valid/);
});

test("leaving the settings out keeps what is there, and a new area starts with pay on delivery off", () => {
  const live = { areas: [{ ...accra, cod: true }, tema], cod: { enabled: true, maxOrderMinor: 70_000 } };
  const kept = parseDeliverySettings({ areas: [{ id: "accra", label: "Accra", feeMinor: 3000, active: true }, { label: "Kasoa", feeMinor: 4000, active: true }] }, live);
  assert.equal(kept.areas[0].cod, true);
  assert.equal(kept.areas[1].cod, false);
  assert.deepEqual(kept.cod, live.cod);
  assert.throws(() => parseDeliveryAreas({ areas: [{ ...accra, cod: "yes" }] }, live.areas), DeliveryInputError);
});

test("payment methods: paystack is the default, anything else is refused", () => {
  assert.equal(parsePaymentMethod(undefined), "paystack");
  assert.equal(parsePaymentMethod("cash_on_delivery"), "cash_on_delivery");
  assert.throws(() => parsePaymentMethod("bitcoin"), RangeError);
});

test("an unconfirmed order cannot be delivered; a confirmed one can; the money step is explicit", () => {
  assert.equal(fulfillmentTransition("pay_on_delivery", "unfulfilled", "preparing", false), null);
  assert.equal(fulfillmentTransition("pay_on_delivery", "unfulfilled", "preparing", true), "advance");
  assert.equal(fulfillmentTransition("paid", "unfulfilled", "preparing"), "advance");
  assert.equal(fulfillmentTransition("cancelled", "unfulfilled", "preparing", true), null);
  assert.equal(fulfillmentTransition("pay_on_delivery", "dispatched", "delivered", true), "advance");
  assert.equal(parseFulfillmentInput({ status: "preparing" }).cashReceived, false);
  assert.equal(parseFulfillmentInput({ status: "preparing", cashReceived: true }).cashReceived, true);
  assert.equal(parseFulfillmentInput({ status: "preparing", cashReceived: "true" }).cashReceived, false);
});

test("who needs a phone call, what unlocks delivery, what can be cancelled", () => {
  const waiting = { status: "pay_on_delivery", paymentMethod: "cash_on_delivery", codConfirmedAt: null };
  const confirmed = { ...waiting, codConfirmedAt: "2026-11-16T10:00:00.000Z" };
  assert.equal(needsPhoneConfirmation(waiting), true);
  assert.equal(needsPhoneConfirmation(confirmed), false);
  assert.equal(deliveryUnlocked(waiting), false);
  assert.equal(deliveryUnlocked(confirmed), true);
  assert.equal(deliveryUnlocked({ status: "paid" }), true);
  assert.equal(deliveryUnlocked({ status: "cancelled", codConfirmedAt: "x" }), false);
  assert.equal(isCodOrder(waiting), true);
  assert.equal(isCodOrder({ status: "paid" }), false);
  assert.equal(canCancelCod(confirmed), true);
  assert.equal(canCancelCod({ ...confirmed, fulfillment: { status: "delivered" } }), false);
  assert.equal(canCancelCod({ status: "paid" }), false);
});

test("an unconfirmed order is held for 48 hours", () => {
  assert.equal(codHoldHours, 48);
  assert.equal(codHoldUntil(Date.UTC(2026, 10, 16, 10, 0, 0)), "2026-11-18T10:00:00.000Z");
});

test("the Track page shows what the customer needs, never the phone or address", () => {
  const base = { reference: "VG-" + "a".repeat(32), createdAt: "2026-11-16T09:00:00.000Z", paidAt: null, totalMinor: 28_000, paymentMethod: "cash_on_delivery" };
  const waiting = publicTrackingView({ ...base, status: "pay_on_delivery", codConfirmedAt: null }, []);
  assert.equal(waiting.awaitingConfirmation, true);
  assert.equal(waiting.amountDueMinor, 28_000);
  assert.equal(waiting.paymentMethod, "cash_on_delivery");
  const moving = publicTrackingView({ ...base, status: "pay_on_delivery", codConfirmedAt: "2026-11-16T10:00:00.000Z", fulfillment: { status: "dispatched", provider: "VEGORA rider", trackingReference: "RID-1", updatedAt: null } }, [{ status: "dispatched", at: "2026-11-16T11:00:00.000Z" }]);
  assert.equal(moving.awaitingConfirmation, false);
  assert.equal(moving.fulfillmentStatus, "dispatched");
  assert.equal(moving.trackingReference, "RID-1");
  const cancelled = publicTrackingView({ ...base, status: "cancelled", cancelledAt: "2026-11-16T12:00:00.000Z" }, []);
  assert.equal(cancelled.cancelledAt, "2026-11-16T12:00:00.000Z");
  assert.equal(cancelled.amountDueMinor, null);
  const paid = publicTrackingView({ ...base, status: "paid", paidAt: "2026-11-16T13:00:00.000Z" }, []);
  assert.equal(paid.amountDueMinor, null);
  assert.ok(!JSON.stringify(waiting).includes("phone"));
});
