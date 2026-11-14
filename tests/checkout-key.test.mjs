import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { newCheckoutKey } from "../src/lib/checkout-key.ts";

const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("uses randomUUID when the browser has it", () => {
  const key = newCheckoutKey({ randomUUID: () => "11111111-2222-4333-8444-555555555555", getRandomValues: (array) => array });
  assert.equal(key, "11111111-2222-4333-8444-555555555555");
});

test("older browsers without randomUUID still get a valid, different key each time", () => {
  const old = { getRandomValues: (array) => webcrypto.getRandomValues(array) };
  const keys = new Set();
  for (let index = 0; index < 200; index += 1) {
    const key = newCheckoutKey(old);
    assert.match(key, pattern);
    keys.add(key);
  }
  assert.equal(keys.size, 200);
});
