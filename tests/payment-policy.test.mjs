import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentAction } from "../src/lib/server/payment-policy.ts";

const now = "2026-10-27T10:00:00.000Z";
const order = { reference: "VG-abc", status: "pending_payment", totalMinor: 12345,
  currency: "GHS", email: "buyer@example.com", reservationExpiresAt: "2026-10-27T10:30:00.000Z" };
const verified = { status: "success", reference: "VG-abc", amount: 12345, currency: "GHS",
  domain: "test", customerEmail: "buyer@example.com" };

test("captures only exact, timely test payments", () => {
  assert.equal(paymentAction(order, verified, now, "test"), "capture");
  assert.equal(paymentAction(order, { ...verified, amount: 12344 }, now, "test"), "release_review");
  assert.equal(paymentAction(order, { ...verified, currency: "NGN" }, now, "test"), "release_review");
  assert.equal(paymentAction(order, { ...verified, domain: "live" }, now, "test"), "release_review");
  assert.equal(paymentAction(order, { ...verified, customerEmail: "other@example.com" }, now, "test"), "release_review");
  assert.equal(paymentAction(order, verified, "2026-10-27T10:31:00.000Z", "test"), "release_review");
});

test("repeated or late events do not consume stock twice", () => {
  assert.equal(paymentAction({ ...order, status: "paid" }, verified, now, "test"), "keep");
  assert.equal(paymentAction({ ...order, status: "expired" }, verified, now, "test"), "review");
  assert.equal(paymentAction({ ...order, status: "paid" }, { ...verified, status: "reversed" }, now, "test"), "reverse_review");
});

test("failed payments release active reservations; pending payments keep them", () => {
  assert.equal(paymentAction(order, { ...verified, status: "failed" }, now, "test"), "release_failed");
  assert.equal(paymentAction(order, { ...verified, status: "pending" }, now, "test"), "keep");
});

test("in live mode only live payments are captured", () => {
  const live = { ...verified, domain: "live" };
  assert.equal(paymentAction(order, live, now, "live"), "capture");
  assert.equal(paymentAction(order, verified, now, "live"), "release_review");
});
