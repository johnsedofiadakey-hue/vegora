import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentAction } from "../src/lib/server/payment-policy.ts";

const now = "2026-10-27T10:00:00.000Z";
const order = { reference: "VG-abc", status: "pending_payment", totalMinor: 12345,
  currency: "GHS", email: "buyer@example.com", reservationExpiresAt: "2026-10-27T10:30:00.000Z" };
const verified = { status: "success", reference: "VG-abc", amount: 12345, currency: "GHS",
  domain: "test", customerEmail: "buyer@example.com" };

test("captures only exact, timely test payments", () => {
  assert.equal(paymentAction(order, verified, now), "capture");
  assert.equal(paymentAction(order, { ...verified, amount: 12344 }, now), "release_review");
  assert.equal(paymentAction(order, { ...verified, currency: "NGN" }, now), "release_review");
  assert.equal(paymentAction(order, { ...verified, domain: "live" }, now), "release_review");
  assert.equal(paymentAction(order, { ...verified, customerEmail: "other@example.com" }, now), "release_review");
  assert.equal(paymentAction(order, verified, "2026-10-27T10:31:00.000Z"), "release_review");
});

test("repeated or late events do not consume stock twice", () => {
  assert.equal(paymentAction({ ...order, status: "paid" }, verified, now), "keep");
  assert.equal(paymentAction({ ...order, status: "expired" }, verified, now), "review");
  assert.equal(paymentAction({ ...order, status: "paid" }, { ...verified, status: "reversed" }, now), "reverse_review");
});

test("failed payments release active reservations; pending payments keep them", () => {
  assert.equal(paymentAction(order, { ...verified, status: "failed" }, now), "release_failed");
  assert.equal(paymentAction(order, { ...verified, status: "pending" }, now), "keep");
});
