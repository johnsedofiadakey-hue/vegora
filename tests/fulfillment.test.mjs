import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedNextStatuses, canAdvanceFulfillment, FulfillmentInputError, fulfillmentTransition,
  parseFulfillmentInput, parseTrackingLookup, publicMilestones, publicTrackingView,
  requiresTrackingReference, trackingLookupMatches,
} from "../src/lib/fulfillment.ts";

const reference = "VG-0123456789abcdef0123456789abcdef";

test("delivery cannot advance before payment or skip a step", () => {
  assert.equal(canAdvanceFulfillment("pending_payment", "unfulfilled", "preparing"), false);
  assert.equal(canAdvanceFulfillment("review_required", "unfulfilled", "preparing"), false);
  assert.equal(canAdvanceFulfillment("paid", "unfulfilled", "dispatched"), false);
  assert.equal(canAdvanceFulfillment("paid", "unfulfilled", "preparing"), true);
  assert.equal(canAdvanceFulfillment("paid", "preparing", "dispatched"), true);
  assert.equal(canAdvanceFulfillment("paid", "dispatched", "delivered"), true);
  assert.equal(canAdvanceFulfillment("paid", "delivered", "preparing"), false);
  assert.equal(requiresTrackingReference("preparing"), false);
  assert.equal(requiresTrackingReference("dispatched"), true);
});

test("a mistaken step can be undone one step back, but delivered is final", () => {
  assert.equal(fulfillmentTransition("paid", "dispatched", "preparing"), "rollback");
  assert.equal(fulfillmentTransition("paid", "preparing", "unfulfilled"), "rollback");
  assert.equal(fulfillmentTransition("paid", "dispatched", "unfulfilled"), null);
  assert.equal(fulfillmentTransition("paid", "delivered", "dispatched"), null);
  assert.equal(fulfillmentTransition("paid", "delivered", "delivered"), "update");
  assert.equal(fulfillmentTransition("paid", "preparing", "preparing"), "update");
  assert.equal(fulfillmentTransition("paid", "preparing", "delivered"), null);
  // Rollback is also payment-gated: a reversed payment locks the order.
  assert.equal(fulfillmentTransition("review_required", "dispatched", "preparing"), null);
  assert.equal(fulfillmentTransition("paid", "nonsense", "preparing"), null);
  assert.deepEqual(allowedNextStatuses("unfulfilled"), ["unfulfilled", "preparing"]);
  assert.deepEqual(allowedNextStatuses("preparing"), ["unfulfilled", "preparing", "dispatched"]);
  assert.deepEqual(allowedNextStatuses("dispatched"), ["preparing", "dispatched", "delivered"]);
  assert.deepEqual(allowedNextStatuses("delivered"), ["delivered"]);
});

test("delivery update input is validated before anything is written", () => {
  const ok = parseFulfillmentInput({ status: "dispatched", provider: " VEGORA delivery ", trackingReference: " VG-DEL-1001 ", note: " left with front desk " });
  assert.deepEqual(ok, { status: "dispatched", provider: "VEGORA delivery", trackingReference: "VG-DEL-1001", note: "left with front desk" });
  assert.deepEqual(parseFulfillmentInput({ status: "preparing" }), { status: "preparing", provider: "", trackingReference: "", note: "" });
  assert.equal(parseFulfillmentInput({ status: "preparing", note: "line one\nline two" }).note, "line one\nline two");

  const rejected = [
    null, [], "preparing", {},
    { status: "shipped" },
    { status: "preparing", provider: 42 },
    { status: "preparing", provider: "<script>" },
    { status: "preparing", trackingReference: "ab" },
    { status: "preparing", trackingReference: "has space" },
    { status: "preparing", trackingReference: "x".repeat(101) },
    { status: "preparing", provider: "x".repeat(101) },
    { status: "preparing", note: "x".repeat(501) },
    { status: "preparing", note: "bad\u0000char" },
    { status: "dispatched", provider: "VEGORA delivery" },
    { status: "dispatched", trackingReference: "VG-DEL-1001" },
    { status: "delivered" },
  ];
  for (const value of rejected) {
    assert.throws(() => parseFulfillmentInput(value), FulfillmentInputError, JSON.stringify(value));
  }
});

test("tracking lookups need a well-formed reference and email, and mismatches look identical", () => {
  assert.deepEqual(
    parseTrackingLookup({ reference: ` VG-${"ABCDEF0123456789".repeat(2)} `, email: " Customer@Example.com " }),
    { reference: `VG-${"abcdef0123456789".repeat(2)}`, email: "customer@example.com" },
  );
  for (const value of [null, [], "x", {}, { reference }, { email: "a@b.co" },
    { reference: "VG-short", email: "a@b.co" }, { reference: `${reference}0`, email: "a@b.co" },
    { reference: reference.replace("VG-", "XX-"), email: "a@b.co" },
    { reference, email: "not-an-email" }, { reference, email: `${"a".repeat(250)}@b.co` },
    { reference: 5, email: "a@b.co" }]) {
    assert.throws(() => parseTrackingLookup(value), FulfillmentInputError, JSON.stringify(value));
  }
  assert.equal(trackingLookupMatches({ email: "customer@example.com" }, "customer@example.com"), true);
  assert.equal(trackingLookupMatches({ email: "Customer@Example.com " }, "customer@example.com"), true);
  assert.equal(trackingLookupMatches({ email: "customer@example.com" }, "other@example.com"), false);
  assert.equal(trackingLookupMatches(null, "customer@example.com"), false);
});

test("customers do not see duplicate or retracted updates", () => {
  const at = (n) => `2026-10-31T1${n}:00:00.000Z`;
  // A corrected tracking reference repeats the dispatched status.
  assert.deepEqual(publicMilestones([
    { status: "preparing", at: at(0) }, { status: "dispatched", at: at(1) }, { status: "dispatched", at: at(2) },
  ]), [{ status: "preparing", at: at(0) }, { status: "dispatched", at: at(1) }]);
  // Dispatch undone: only preparing remains.
  assert.deepEqual(publicMilestones([
    { status: "preparing", at: at(0) }, { status: "dispatched", at: at(1) }, { status: "preparing", at: at(2) },
  ]), [{ status: "preparing", at: at(0) }]);
  // Dispatch undone then redone: the new dispatch time is shown, preparing keeps its original time.
  assert.deepEqual(publicMilestones([
    { status: "preparing", at: at(0) }, { status: "dispatched", at: at(1) },
    { status: "preparing", at: at(2) }, { status: "dispatched", at: at(3) },
  ]), [{ status: "preparing", at: at(0) }, { status: "dispatched", at: at(3) }]);
  // Everything undone.
  assert.deepEqual(publicMilestones([
    { status: "preparing", at: at(0) }, { status: "unfulfilled", at: at(1) },
  ]), []);
  assert.deepEqual(publicMilestones([]), []);
});

test("public tracking contains progress but no customer or operator data", () => {
  const order = {
    reference,
    status: "paid",
    createdAt: "2026-10-31T10:00:00.000Z",
    paidAt: "2026-10-31T10:05:00.000Z",
    email: "customer@example.com",
    customer: { name: "Private Customer" },
    delivery: { addressLine1: "Private address" },
    fulfillment: { status: "dispatched", provider: "VEGORA delivery", trackingReference: "VG-DEL-1001", updatedAt: "2026-10-31T12:00:00.000Z" },
  };
  const events = [{ status: "dispatched", provider: "VEGORA delivery", trackingReference: "VG-DEL-1001", at: "2026-10-31T12:00:00.000Z", actorUid: "private-operator", note: "private operator note" }];
  const result = publicTrackingView(order, events);
  assert.equal(result.orderId, order.reference);
  assert.equal(result.fulfillmentStatus, "dispatched");
  assert.equal(result.trackingReference, "VG-DEL-1001");
  assert.deepEqual(result.updates, [{ status: "dispatched", at: "2026-10-31T12:00:00.000Z" }]);
  const serialized = JSON.stringify(result);
  for (const secret of ["customer@example.com", "Private Customer", "Private address", "private-operator", "private operator note"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("delivery details stay hidden until dispatch and for unpaid orders", () => {
  const base = { reference, createdAt: "2026-10-31T10:00:00.000Z", paidAt: null };
  const details = { provider: "VEGORA delivery", trackingReference: "VG-DEL-1001", updatedAt: "2026-10-31T12:00:00.000Z" };
  const events = [{ status: "preparing", at: "2026-10-31T11:00:00.000Z" }, { status: "dispatched", at: "2026-10-31T12:00:00.000Z" }];

  const preparing = publicTrackingView({ ...base, status: "paid", fulfillment: { status: "preparing", ...details } }, events);
  assert.equal(preparing.trackingReference, null);
  assert.equal(preparing.provider, null);

  // A payment reversed after dispatch must not keep advertising delivery progress.
  for (const status of ["review_required", "pending_payment", "failed", "expired", "initializing"]) {
    const view = publicTrackingView({ ...base, status, fulfillment: { status: "dispatched", ...details } }, events);
    assert.equal(view.fulfillmentStatus, "unfulfilled", status);
    assert.equal(view.trackingReference, null, status);
    assert.equal(view.provider, null, status);
    assert.deepEqual(view.updates, [], status);
  }

  const legacy = publicTrackingView({ ...base, status: "paid" }, []);
  assert.equal(legacy.fulfillmentStatus, "unfulfilled");
});
