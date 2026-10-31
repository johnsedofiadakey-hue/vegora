import test from "node:test";
import assert from "node:assert/strict";
import { clientAddress, createRateLimiter, rateLimited } from "../src/lib/server/rate-limit.ts";

test("allows up to the limit, then says how long to wait", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
  const t = 1_000_000;
  for (let attempt = 0; attempt < 3; attempt += 1) assert.equal(limiter.check("a", t + attempt).ok, true);
  const blocked = limiter.check("a", t + 10_000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfterSeconds, 50);
  assert.equal(limiter.check("a", t + 59_999).ok, false);
});

test("the count starts again once the window has passed", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
  assert.equal(limiter.check("a", 0).ok, true);
  assert.equal(limiter.check("a", 500).ok, false);
  assert.equal(limiter.check("a", 1000).ok, true);
  assert.equal(limiter.check("a", 1001).ok, false);
});

test("each key is counted on its own", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
  assert.equal(limiter.check("one@example.com", 0).ok, true);
  assert.equal(limiter.check("one@example.com", 1).ok, false);
  assert.equal(limiter.check("two@example.com", 2).ok, true);
});

test("memory stays bounded: the oldest keys are forgotten first", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 10 });
  assert.equal(limiter.check("first", 0).ok, true);
  assert.equal(limiter.check("first", 1).ok, false);
  for (let index = 0; index < 50; index += 1) limiter.check(`other-${index}`, 2 + index);
  // "first" was pushed out, so it is counted afresh. That is the cost of bounded memory.
  assert.equal(limiter.check("first", 100).ok, true);
  // A recent key is still remembered.
  assert.equal(limiter.check("other-49", 101).ok, false);
});

test("the caller address is the first forwarded value, or 'unknown'", () => {
  const request = (value) => new Request("https://example.test/", { headers: value === undefined ? {} : { "x-forwarded-for": value } });
  assert.equal(clientAddress(request("203.0.113.9")), "203.0.113.9");
  assert.equal(clientAddress(request(" 203.0.113.9 , 10.0.0.1, 10.0.0.2")), "203.0.113.9");
  assert.equal(clientAddress(request("2001:db8::1")), "2001:db8::1");
  assert.equal(clientAddress(request(undefined)), "unknown");
  assert.equal(clientAddress(request("")), "unknown");
  assert.equal(clientAddress(request("x".repeat(100))), "unknown");
});

test("a refused request is a 429 that says when to retry", async () => {
  const response = rateLimited(42);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "42");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match((await response.json()).error, /Too many attempts/);
});
