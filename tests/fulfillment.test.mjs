import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedNextStatuses, canAdvanceFulfillment, FulfillmentInputError, fulfillmentTransition,
  normalizeShortCode, parseFulfillmentInput, parseTrackingLookup, publicMilestones, publicTrackingView, shortCodePattern, shortOrderCode,
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

test("tracking lookups need a well-formed reference and a phone number, and mismatches look identical", () => {
  assert.deepEqual(
    parseTrackingLookup({ reference: ` VG-${"ABCDEF0123456789".repeat(2)} `, contact: "0244 123 456" }),
    { reference: `VG-${"abcdef0123456789".repeat(2)}`, shortCode: null, email: null, phoneKey: "244123456" },
  );
  // The short order number works too, however a person types it.
  for (const typed of ["VG-7K2M9QXA", "vg-7k2m9qxa", " VG7K2M9QXA ", "7K2M 9QXA", "vg 7k2m-9qxa"]) {
    assert.deepEqual(parseTrackingLookup({ reference: typed, contact: "+233 24 412 3456" }), { reference: null, shortCode: "VG-7K2M9QXA", email: null, phoneKey: "244123456" }, typed);
  }
  // An email still works for orders placed before phone numbers were used.
  assert.deepEqual(parseTrackingLookup({ reference: "VG-7K2M9QXA", email: " A@B.co " }), { reference: null, shortCode: "VG-7K2M9QXA", email: "a@b.co", phoneKey: null });
  for (const value of [null, [], "x", {}, { reference }, { contact: "0244123456" },
    { reference: "VG-short", contact: "0244123456" }, { reference: "VG-7K2M9QX", contact: "0244123456" }, { reference: "VG-7K2M9QXAB", contact: "0244123456" }, { reference: `${reference}0`, contact: "0244123456" },
    { reference: reference.replace("VG-", "XX-"), contact: "0244123456" },
    { reference, contact: "12345" }, { reference, contact: "not-a-phone" }, { reference, contact: "a@" }, { reference, contact: `${"a".repeat(250)}@b.co` },
    { reference: 5, contact: "0244123456" }]) {
    assert.throws(() => parseTrackingLookup(value), FulfillmentInputError, JSON.stringify(value));
  }
  const phone = { email: null, phoneKey: "244123456" };
  assert.equal(trackingLookupMatches({ customer: { phone: "0244 123 456" } }, phone), true);
  assert.equal(trackingLookupMatches({ customer: { phone: "+233244123456" } }, phone), true);
  assert.equal(trackingLookupMatches({ customer: { phone: "0244123457" } }, phone), false);
  assert.equal(trackingLookupMatches({ customer: { phone: "12" } }, phone), false);
  assert.equal(trackingLookupMatches({}, phone), false);
  assert.equal(trackingLookupMatches(null, phone), false);
  assert.equal(trackingLookupMatches({ email: "Customer@Example.com " }, { email: "customer@example.com", phoneKey: null }), true);
  assert.equal(trackingLookupMatches({ email: "customer@example.com" }, { email: "other@example.com", phoneKey: null }), false);
  assert.equal(trackingLookupMatches({ email: "customer@example.com" }, { email: null, phoneKey: null }), false);
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
  assert.equal(result.orderId, shortOrderCode(order.reference));
  assert.equal(JSON.stringify(result).includes(order.reference), false, "the long payment reference is not shown to customers");
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

test("the short order number is stable, readable and tied to the reference", () => {
  const references = ["VG-0123456789abcdef0123456789abcdef", "VG-ffffffffffffffffffffffffffffffff", "VG-00000000000000000000000000000000"];
  assert.equal(shortOrderCode(references[0]), "VG-04HMASW9");
  assert.equal(shortOrderCode(references[1]), "VG-ZZZZZZZZ");
  assert.equal(shortOrderCode(references[2]), "VG-00000000");
  assert.equal(shortOrderCode(references[0].toUpperCase().replace("VG-", "VG-")), shortOrderCode(references[0]));
  for (const reference of references) assert.match(shortOrderCode(reference), shortCodePattern);
  for (const bad of ["", "VG-short", "XX-0123456789abcdef0123456789abcdef", "VG-0123456789abcdef0123456789abcde", "VG-0123456789abcdef0123456789abcdefAA", null]) {
    assert.equal(shortOrderCode(bad ?? ""), null, String(bad));
  }
  // The alphabet leaves out I, L, O and U, so no code can be misread.
  for (let index = 0; index < 400; index += 1) {
    const hex = Array.from({ length: 32 }, (_, at) => ((index * 31 + at * 7) % 16).toString(16)).join("");
    assert.match(shortOrderCode(`VG-${hex}`), /^VG-[0-9A-HJKMNP-TV-Z]{8}$/);
  }
});

test("a mistyped order number is forgiven only where it is unambiguous", () => {
  assert.equal(normalizeShortCode("vg-0o0o0o0o"), "VG-00000000");
  assert.equal(normalizeShortCode("VG-1IL1IL1I"), "VG-11111111");
  assert.equal(normalizeShortCode("VG-7K2M9QX"), null);
  assert.equal(normalizeShortCode("VG-7K2M9QXAA"), null);
  assert.equal(normalizeShortCode("VG-7K2M9QX!"), null);
  assert.equal(normalizeShortCode("VG-7K2M9QXU"), null);
  assert.equal(normalizeShortCode(""), null);
  assert.equal(normalizeShortCode("0123456789abcdef0123456789abcdef"), null);
});

test("the public tracking view shows the order contents but never personal or internal details", () => {
  const order = {
    reference, status: "paid", createdAt: "2026-10-31T10:00:00.000Z", paidAt: "2026-10-31T10:05:00.000Z",
    fulfillment: { status: "preparing", provider: null, trackingReference: null, updatedAt: "2026-10-31T11:00:00.000Z" },
    lines: [{ name: "Navy Tee", size: "M", quantity: 2, lineTotalMinor: 20000, sku: "NAVY-M", slug: "navy-tee", variantId: "v1", unitPriceMinor: 10000 }],
    subtotalMinor: 20000, deliveryFeeMinor: 3000, totalMinor: 23000,
    delivery: { zoneLabel: "Accra", addressLine1: "12 Private Road", city: "Accra", region: "Greater Accra" },
    customer: { name: "Private Customer", phone: "0240000000" }, email: "customer@example.com",
  };
  const view = publicTrackingView(order, [{ status: "preparing", at: "2026-10-31T11:00:00.000Z" }]);
  assert.deepEqual(view.items, [{ name: "Navy Tee", size: "M", quantity: 2, lineTotalMinor: 20000 }]);
  assert.equal(view.deliveryArea, "Accra");
  assert.equal(view.totalMinor, 23000);
  assert.equal(view.lastUpdateAt, "2026-10-31T11:00:00.000Z");
  const text = JSON.stringify(view);
  for (const secret of ["NAVY-M", "navy-tee", "v1", "12 Private Road", "Private Customer", "0240000000", "customer@example.com", reference]) {
    assert.equal(text.includes(secret), false, secret);
  }
  // Orders written before these fields existed still produce a valid view.
  const bare = publicTrackingView({ reference, status: "paid", createdAt: "2026-10-31T10:00:00.000Z", paidAt: null }, []);
  assert.deepEqual(bare.items, []);
  assert.equal(bare.totalMinor, null);
  assert.equal(bare.lastUpdateAt, "2026-10-31T10:00:00.000Z");
});
