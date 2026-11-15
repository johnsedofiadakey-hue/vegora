import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { clientErrorScript, parseClientError } from "../src/lib/client-error.ts";

const require = createRequire(import.meta.url);
const acorn = require("acorn");

test("the reporting script is plain old JavaScript, so it runs on an iPhone 6", () => {
  assert.doesNotThrow(() => acorn.parse(clientErrorScript, { ecmaVersion: 5 }));
  assert.ok(!clientErrorScript.includes("=>"));
});

test("the script sends the error text, the page and the browser, nothing typed by the visitor", () => {
  assert.match(clientErrorScript, /\/api\/client-error/);
  for (const word of ["cookie", "localStorage", "sessionStorage", "document.body", "value"]) assert.ok(!clientErrorScript.includes(word), word);
});

test("a good report is kept and cut to a safe length", () => {
  const report = parseClientError({ kind: "error", message: "x".repeat(900), source: "/_next/a.js", line: 12.7, col: 3, page: "/", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 12_5_7 like Mac OS X)", extra: "ignored" });
  assert.equal(report.message.length, 300);
  assert.equal(report.line, 12);
  assert.equal(report.extra, undefined);
  assert.match(report.ua, /iPhone OS 12_5_7/);
});

test("rubbish is dropped", () => {
  for (const bad of [null, "text", [], {}, { kind: "error" }, { kind: "other", message: "x" }, { kind: "error", message: "   " }]) assert.equal(parseClientError(bad), null);
  const report = parseClientError({ kind: "resource", message: "a\nb\u0000c", line: -5, col: "7" });
  assert.equal(report.message, "a b c");
  assert.equal(report.line, 0);
  assert.equal(report.col, 0);
});
