import test from "node:test";
import assert from "node:assert/strict";
import {
  addSavedOrder, maskContact, maxSavedOrders, orderFromSearch, parseSavedOrders, removeSavedOrder, trackLink,
} from "../src/lib/saved-orders.ts";

const when = new Date("2026-11-02T12:00:00.000Z");

test("saved orders keep a clean, de-duplicated, newest-first list", () => {
  let list = addSavedOrder([], "vg-7k2m9qxa", " 0244  123 456 ", when);
  assert.deepEqual(list, [{ code: "VG-7K2M9QXA", contact: "0244 123 456", savedAt: when.toISOString() }]);
  list = addSavedOrder(list, "VG-00000001", "0244123456", when);
  list = addSavedOrder(list, "VG-7K2M9QXA", "0244123456", when);
  assert.deepEqual(list.map((item) => item.code), ["VG-7K2M9QXA", "VG-00000001"]);
  assert.deepEqual(addSavedOrder(list, "not-an-order", "0244123456", when), list);
  assert.deepEqual(addSavedOrder(list, "VG-7K2M9QXA", "nope", when), list);
  assert.deepEqual(addSavedOrder(list, "VG-7K2M9QXA", "12345", when), list);
  // An email is still accepted, for orders placed before phone numbers were used.
  assert.equal(addSavedOrder([], "VG-7K2M9QXA", " Ama@Example.com ", when)[0].contact, "ama@example.com");
});

test("only the newest few orders are kept, and one can be removed", () => {
  let list = [];
  for (let index = 0; index < maxSavedOrders + 3; index += 1) list = addSavedOrder(list, `VG-0000000${index}`, "0244123456", when);
  assert.equal(list.length, maxSavedOrders);
  assert.equal(list[0].code, `VG-0000000${maxSavedOrders + 2}`);
  const removed = removeSavedOrder(list, list[1].code.toLowerCase());
  assert.equal(removed.length, maxSavedOrders - 1);
  assert.equal(removed.some((item) => item.code === list[1].code), false);
});

test("stored data that was tampered with or is malformed is ignored, never thrown on", () => {
  assert.deepEqual(parseSavedOrders(null), []);
  assert.deepEqual(parseSavedOrders("{not json"), []);
  assert.deepEqual(parseSavedOrders('{"a":1}'), []);
  const raw = JSON.stringify([
    { code: "VG-7K2M9QXA", contact: "0244123456", savedAt: when.toISOString() },
    { code: "VG-7K2M9QXA", contact: "0200000000", savedAt: when.toISOString() },
    { code: "<script>", contact: "0244123456", savedAt: when.toISOString() },
    { code: "VG-00000002", contact: "bad", savedAt: when.toISOString() },
    { code: "VG-00000003", contact: "0244123456", savedAt: "yesterday" },
    null, 4, { code: 5 },
  ]);
  assert.deepEqual(parseSavedOrders(raw).map((item) => item.code), ["VG-7K2M9QXA"]);
});

test("the shareable track link carries only the order number", () => {
  const link = trackLink("https://www.shopvegora.com", "VG-7K2M9QXA");
  assert.equal(link, "https://www.shopvegora.com/track?order=VG-7K2M9QXA");
  assert.equal(orderFromSearch("?order=vg-7k2m9qxa"), "VG-7K2M9QXA");
  assert.equal(orderFromSearch("?order=%3Cscript%3E"), null);
  assert.equal(orderFromSearch("?order=" + "A".repeat(100)), null);
  assert.equal(orderFromSearch(""), null);
  assert.equal(maskContact("ama@example.com"), "am…@example.com");
  assert.equal(maskContact("0244 123 456"), "••• ••• 456");
});
