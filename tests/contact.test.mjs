import test from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderEmail, maskPhone, phoneKey, placeholderEmail } from "../src/lib/contact.ts";

test("the same Ghana number is recognised however it is typed", () => {
  for (const typed of ["0244123456", "024 412 3456", "+233 24 412 3456", "233244123456", "(024) 412-3456"]) {
    assert.equal(phoneKey(typed), "244123456", typed);
  }
  assert.equal(phoneKey("0244123457"), "244123457");
});

test("numbers that are too short or too long are rejected", () => {
  for (const bad of ["", "12345", "024412345", "abc", "1".repeat(16)]) assert.equal(phoneKey(bad), null, bad);
  assert.equal(placeholderEmail("12345"), null);
});

test("the placeholder email is stable, valid for Paystack and clearly not a real address", () => {
  const email = placeholderEmail("+233 24 412 3456");
  assert.equal(email, "p244123456@customer.shopvegora.com");
  assert.equal(placeholderEmail("0244123456"), email);
  assert.match(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.equal(isPlaceholderEmail(email), true);
  assert.equal(isPlaceholderEmail(email.toUpperCase()), true);
  assert.equal(isPlaceholderEmail("ama@example.com"), false);
});

test("a phone number is shown only by its last three digits", () => {
  assert.equal(maskPhone("0244123456"), "••• ••• 456");
  assert.equal(maskPhone("12"), "•••");
});
