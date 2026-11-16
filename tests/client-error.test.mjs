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

// A tiny stand-in for a browser, enough to run the script and watch what it does to photographs.
function browser({ webp }) {
  const listeners = { window: {}, document: {} };
  const sentReports = [];
  const observers = [];
  class Img {
    constructor(attrs) { this.attrs = { ...attrs }; this.tagName = "IMG"; this.nodeType = 1; }
    getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    get src() { return this.attrs.src || ""; }
  }
  const images = [];
  const document = {
    documentElement: {},
    createElement: () => ({ toDataURL: (type) => webp ? `data:${type};base64,xx` : "data:image/png;base64,xx" }),
    addEventListener: (type, fn) => { (listeners.document[type] ||= []).push(fn); },
    getElementsByTagName: () => images,
  };
  const window = { addEventListener: (type, fn) => { (listeners.window[type] ||= []).push(fn); } };
  class MutationObserver { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} }
  class XMLHttpRequest { open() {} setRequestHeader() {} send(body) { sentReports.push(JSON.parse(body)); } }
  new Function("window", "document", "location", "navigator", "MutationObserver", "XMLHttpRequest", clientErrorScript)(
    window, document, { pathname: "/men" }, { userAgent: "test" }, MutationObserver, XMLHttpRequest);
  return {
    Img, images, sentReports, observers,
    fire: (type, event, where = "window") => (listeners[where][type] || []).forEach((fn) => fn(event)),
  };
}

const webpUrl = (w) => `/api/image?src=%2Fcatalog%2Fred-stripe.webp&w=${w}&q=75`;
const jpgUrl = (w) => `/api/image?src=%2Fcatalog%2Fred-stripe.webp&w=${w}&f=jpg&q=75`;
const photo = () => ({ src: webpUrl(3840), srcset: `${webpUrl(384)} 384w, ${webpUrl(750)} 750w` });

test("a photograph that fails to load is asked for again as a JPEG, once", () => {
  const page = browser({ webp: true });
  const img = new page.Img(photo());
  page.fire("error", { target: img });
  assert.equal(img.getAttribute("src"), jpgUrl(3840));
  assert.equal(img.getAttribute("srcset"), `${jpgUrl(384)} 384w, ${jpgUrl(750)} 750w`);
  assert.equal(page.sentReports.length, 0, "a normal fallback is not an error report");
  // If the JPEG fails as well, that is reported, and nothing loops.
  page.fire("error", { target: img });
  assert.equal(page.sentReports.length, 1);
  assert.match(page.sentReports[0].message, /failed to load/);
  assert.equal(img.getAttribute("src"), jpgUrl(3840));
});

test("a phone that cannot show WebP has its photographs switched before they load", () => {
  const page = browser({ webp: false });
  const img = new page.Img(photo());
  page.images.push(img);
  page.fire("DOMContentLoaded", {}, "document");
  assert.equal(img.getAttribute("src"), jpgUrl(3840));
  assert.ok(img.getAttribute("srcset").split(", ").every((entry) => entry.includes("&f=jpg&q=75")));
  // Photographs added later by the site (moving between pages) are switched too, and switching is not repeated.
  const later = new page.Img(photo());
  page.observers[0].fn([{ type: "childList", addedNodes: [later] }]);
  assert.equal(later.getAttribute("src"), jpgUrl(3840));
  page.observers[0].fn([{ type: "attributes", target: later }]);
  assert.equal(later.getAttribute("src"), jpgUrl(3840));
});

test("a phone that can show WebP is left alone, and other images and scripts are not touched", () => {
  const page = browser({ webp: true });
  assert.equal(page.observers.length, 0);
  const logo = new page.Img({ src: "/icon.svg" });
  page.fire("error", { target: logo });
  assert.equal(logo.getAttribute("src"), "/icon.svg");
  assert.equal(page.sentReports.length, 1, "an image that is not one of ours is still reported");
  page.fire("error", { target: { tagName: "SCRIPT", src: "/_next/static/chunks/a.js" } });
  assert.match(page.sentReports[1].message, /a\.js/);
});
