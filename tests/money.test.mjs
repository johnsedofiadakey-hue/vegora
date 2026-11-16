import assert from "node:assert/strict";
import test from "node:test";
import { formatGhs } from "../src/lib/catalog.ts";
import { formatMoney } from "../src/components/storefront/catalog-types.ts";

test("money prints the same on the server and on every phone, and matches what the shop showed before", () => {
  const before = (minor) => new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(minor / 100);
  for (const minor of [0, 5, 99, 100, 3000, 25000, 28000, 123456, 1000000, 123456789, 100000000]) {
    assert.equal(formatMoney(minor), before(minor), String(minor));
    assert.equal(formatGhs(minor), before(minor), String(minor));
  }
  assert.equal(formatMoney(null), "Price unavailable");
  assert.equal(formatGhs(null), "Price on request");
  assert.equal(formatMoney(123456), "GH₵1,234.56");
});
