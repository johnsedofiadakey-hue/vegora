import test from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../src/lib/server/timeout.ts";

test("a slow service is cut off instead of stalling the caller", async () => {
  const started = Date.now();
  await assert.rejects(withTimeout(new Promise(() => {}), 40), /timed out after 40ms/);
  assert.ok(Date.now() - started < 1000);
});

test("a fast result passes through, and a real error is not hidden", async () => {
  assert.equal(await withTimeout(Promise.resolve("ok"), 1000), "ok");
  await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 1000), /boom/);
});
