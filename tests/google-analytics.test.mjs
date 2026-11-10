import test from "node:test";
import assert from "node:assert/strict";
import { gaEvent } from "../src/lib/google-analytics.ts";

test("product events become GA4 ecommerce events", () => {
  assert.deepEqual(gaEvent("ViewContent", { content_ids: ["navy-stripe-tee"], content_name: "Navy Stripe Tee", content_type: "product", value: 250, currency: "GHS" }),
    ["view_item", { items: [{ item_id: "navy-stripe-tee", item_name: "Navy Stripe Tee" }], value: 250, currency: "GHS" }]);
  assert.equal(gaEvent("AddToCart", { content_ids: ["a"] })[0], "add_to_cart");
  assert.equal(gaEvent("AddToWishlist", { content_ids: ["a"] })[0], "add_to_wishlist");
  assert.equal(gaEvent("InitiateCheckout", { content_ids: ["a", "b"] })[0], "begin_checkout");
});

test("a purchase carries the order reference as its transaction id", () => {
  assert.deepEqual(gaEvent("Purchase", { content_ids: ["a", "b"], content_name: "ignored for many", value: 500, currency: "GHS", num_items: 3 }, "VG-123"),
    ["purchase", { items: [{ item_id: "a" }, { item_id: "b" }], value: 500, currency: "GHS", transaction_id: "VG-123" }]);
});

test("nothing personal or unexpected passes through", () => {
  const [, params] = gaEvent("AddToCart", { content_ids: ["a", 7], email: "x@example.com", phone: "024", value: "12" });
  assert.deepEqual(params, { items: [{ item_id: "a" }] });
});
