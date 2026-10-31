import test from "node:test";
import assert from "node:assert/strict";
import {
  absoluteUrl, indexingAllowed, jsonLd, organizationJsonLd, productJsonLd, shareImageUrl, siteOrigin, sitemapPaths, summarize,
} from "../src/lib/seo.ts";

test("search engines stay out unless indexing is switched on exactly", () => {
  assert.equal(indexingAllowed(undefined), false);
  assert.equal(indexingAllowed(""), false);
  assert.equal(indexingAllowed("false"), false);
  assert.equal(indexingAllowed("TRUE"), false);
  assert.equal(indexingAllowed("1"), false);
  assert.equal(indexingAllowed("true"), true);
  assert.equal(indexingAllowed(" true "), true);
});

test("the site address is reduced to a clean origin, with a safe fallback", () => {
  assert.equal(siteOrigin("https://vegora.example/"), "https://vegora.example");
  assert.equal(siteOrigin("https://vegora.example/path?x=1#y"), "https://vegora.example");
  assert.equal(siteOrigin(" https://vegora--vegoragh.europe-west4.hosted.app "), "https://vegora--vegoragh.europe-west4.hosted.app");
  for (const bad of [undefined, "", "not a url", "javascript:alert(1)", "ftp://example.com", "//example.com"]) {
    assert.equal(siteOrigin(bad), "http://localhost:3000", String(bad));
  }
});

test("structured data cannot break out of its script tag", () => {
  const text = jsonLd({ name: "</script><script>alert(1)</script>", note: "a & b > c" });
  assert.equal(text.includes("<"), false);
  assert.equal(text.includes(">"), false);
  assert.equal(text.includes("&"), false);
  // It is still valid JSON that reads back to the original text.
  assert.equal(JSON.parse(text).name, "</script><script>alert(1)</script>");
  assert.equal(JSON.parse(jsonLd({ line: "a" + String.fromCharCode(0x2028) + "b" })).line.length, 3);
  assert.equal(jsonLd({ line: "a" + String.fromCharCode(0x2028) + "b" }).includes(String.fromCharCode(0x2028)), false);
});

test("product markup carries price, currency, stock and absolute image links", () => {
  const origin = "https://vegora.example";
  const markup = productJsonLd({ slug: "red-stripe-tee", name: "Red Stripe T-Shirt", description: "", category: "T-Shirts", priceMinor: 25050, currency: "GHS",
    images: [{ url: "/api/media/014deacf-5394-4f2f-b393-079bc26b6f8c.jpg", alt: "Front" }, { url: "/catalog/red-stripe.webp", alt: "Back" }] }, origin);
  assert.equal(markup["@type"], "Product");
  assert.equal(markup.offers.price, "250.50");
  assert.equal(markup.offers.priceCurrency, "GHS");
  assert.equal(markup.offers.availability, "https://schema.org/InStock");
  assert.equal(markup.offers.url, "https://vegora.example/product/red-stripe-tee");
  assert.equal(markup.description, "Red Stripe T-Shirt from VEGORA.");
  assert.deepEqual(markup.image, [
    "https://vegora.example/api/image?src=%2Fapi%2Fmedia%2F014deacf-5394-4f2f-b393-079bc26b6f8c.jpg&w=1200&q=75",
    "https://vegora.example/api/image?src=%2Fcatalog%2Fred-stripe.webp&w=1200&q=75",
  ]);
  assert.equal(productJsonLd({ slug: "x", name: "X", description: "", category: "c", priceMinor: null, currency: "GHS", images: [] }, origin), null);
  assert.equal(productJsonLd({ slug: "x", name: "X", description: "", category: "c", priceMinor: 0, currency: "GHS", images: [] }, origin).offers.price, "0.00");
});

test("share images are resized links, and other links are made absolute", () => {
  assert.equal(shareImageUrl("https://a.example", "/editorial/ve-man-coat.png"), "https://a.example/api/image?src=%2Feditorial%2Fve-man-coat.png&w=1200&q=75");
  // A path that cannot be resized is shared as it is, never through the resizer.
  assert.equal(shareImageUrl("https://a.example", "/icon.svg"), "https://a.example/icon.svg");
  assert.equal(absoluteUrl("https://a.example", "/men"), "https://a.example/men");
  assert.equal(absoluteUrl("https://a.example", "men"), "https://a.example/men");
  assert.equal(absoluteUrl("https://a.example", "https://b.example/x"), "https://b.example/x");
});

test("organization markup lists Instagram only when there is a handle", () => {
  assert.equal(organizationJsonLd("https://a.example", "").sameAs, undefined);
  assert.deepEqual(organizationJsonLd("https://a.example", "vegora.gh").sameAs, ["https://instagram.com/vegora.gh"]);
  assert.equal(organizationJsonLd("https://a.example", "").url, "https://a.example");
});

test("descriptions are cut on a word and never exceed the limit", () => {
  assert.equal(summarize("Short text."), "Short text.");
  assert.equal(summarize("  lots   of\n\nspace  "), "lots of space");
  const long = "A navy and white striped T-shirt shown from the front and back, cut in a relaxed fit with a ribbed collar and a soft finish that holds its shape wash after wash.";
  const cut = summarize(long, 80);
  assert.ok(cut.length <= 80, cut.length);
  assert.ok(cut.endsWith("…"));
  assert.equal(cut.includes("  "), false);
  assert.ok(long.startsWith(cut.slice(0, -1).trimEnd()));
});

test("the sitemap lists only pages that exist, once each", () => {
  const paths = (input) => sitemapPaths(input).map((entry) => entry.path);
  const base = { womenAvailable: false, productSlugs: [], livePolicyPaths: [] };
  assert.deepEqual(paths(base), ["/", "/men", "/new-in", "/the-edit", "/about"]);
  assert.ok(paths({ ...base, womenAvailable: true }).includes("/women"));
  assert.equal(paths(base).includes("/women"), false);
  assert.deepEqual(paths({ ...base, productSlugs: ["a-tee", "a-tee", "b-tee"] }).filter((path) => path.startsWith("/product/")), ["/product/a-tee", "/product/b-tee"]);
  assert.ok(paths({ ...base, livePolicyPaths: ["/delivery", "/contact"] }).includes("/delivery"));
  for (const hidden of ["/delivery", "/returns", "/privacy", "/terms", "/contact", "/bag", "/checkout", "/track", "/admin"]) {
    assert.equal(paths(base).includes(hidden), false, hidden);
  }
  assert.ok(sitemapPaths(base).every((entry) => entry.priority > 0 && entry.priority <= 1));
});
