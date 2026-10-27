import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { initializePaystack, verifyPaystack, validPaystackSignature, PaystackError } from "../src/lib/server/paystack.ts";

test("initialization sends GHS pesewas and checks provider reference and checkout host", async () => {
  let sent;
  const fakeFetch = async (_url, init) => {
    sent = JSON.parse(init.body);
    return Response.json({ status: true, data: {
      reference: "VG-abc123", authorization_url: "https://checkout.paystack.com/test-link",
    } });
  };
  const result = await initializePaystack({
    secretKey: "sk_test_example", email: "buyer@example.com", amountMinor: 12345,
    reference: "VG-abc123", callbackUrl: "https://example.com/checkout/return",
  }, fakeFetch);
  assert.equal(sent.amount, "12345");
  assert.equal(sent.currency, "GHS");
  assert.equal(sent.reference, "VG-abc123");
  assert.equal(result.authorizationUrl, "https://checkout.paystack.com/test-link");
  await assert.rejects(() => initializePaystack({
    secretKey: "sk_test_example", email: "buyer@example.com", amountMinor: 12345,
    reference: "VG-other", callbackUrl: "https://example.com/checkout/return",
  }, fakeFetch), PaystackError);
});

test("verification reads transaction status, amount, currency, domain and email", async () => {
  const fakeFetch = async () => Response.json({ status: true, data: {
    status: "success", reference: "VG-abc123", amount: 12345, currency: "GHS", domain: "test",
    customer: { email: "buyer@example.com" },
  } });
  assert.deepEqual(await verifyPaystack("VG-abc123", "sk_test_example", fakeFetch), {
    status: "success", reference: "VG-abc123", amount: 12345, currency: "GHS",
    domain: "test", customerEmail: "buyer@example.com",
  });
});

test("webhook signature checks exact raw body and rejects tampering", () => {
  const key = "sk_test_example";
  const body = Buffer.from('{"event":"charge.success","data":{"reference":"VG-abc123"}}');
  const signature = createHmac("sha512", key).update(body).digest("hex");
  assert.equal(validPaystackSignature(body, signature, key), true);
  assert.equal(validPaystackSignature(Buffer.from(body.toString().replace("abc123", "other")), signature, key), false);
  assert.equal(validPaystackSignature(body, "bad", key), false);
});
