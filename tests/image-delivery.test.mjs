import test from "node:test";
import assert from "node:assert/strict";
import { imageUrl, imageWidths, isOptimizableSource, parseImageRequest, snapWidth } from "../src/lib/image-delivery.ts";

const uuid = "014deacf-5394-4f2f-b393-079bc26b6f8c";
const query = (text) => new URLSearchParams(text);

test("only uploaded photographs and the site's own photographs can be resized", () => {
  for (const ok of [`/api/media/${uuid}.jpg`, `/api/media/${uuid}.PNG`, "/catalog/red-stripe.webp", "/editorial/ve-man-coat.png", "/editorial/a_b-c.1.jpeg"]) {
    assert.equal(isOptimizableSource(ok), true, ok);
  }
  for (const bad of ["", "/", "/icon.svg", "/api/media/not-a-uuid.jpg", `/api/media/${uuid}.svg`, `/api/media/${uuid}.jpg/extra`, "/catalog/../../etc/passwd",
    "/catalog/..%2F..%2Fsecret.png", "/catalog/sub/dir.png", "/catalog/.hidden.png", "/catalog/", "/catalog/x", "/editorial//x.png", "//evil.example/x.png",
    "https://evil.example/x.png", "/admin/x.png", "/api/admin/upload", "/catalog/x.png?y=1", "/catalog/x.png#y", "catalog/x.png", "/catalog/x.svg"]) {
    assert.equal(isOptimizableSource(bad), false, bad);
  }
});

test("a requested width is rounded up to a standard size, and never beyond the largest", () => {
  assert.equal(snapWidth(1), 32);
  assert.equal(snapWidth(32), 32);
  assert.equal(snapWidth(33), 48);
  assert.equal(snapWidth(640), 640);
  assert.equal(snapWidth(641), 750);
  assert.equal(snapWidth(2048), 2048);
  assert.equal(snapWidth(3840), 2048);
  assert.equal(snapWidth(99999), 2048);
  for (let width = 1; width <= 4000; width += 37) assert.ok(imageWidths.includes(snapWidth(width)), String(width));
});

test("image requests are validated before anything is read", () => {
  assert.deepEqual(parseImageRequest(query(`src=%2Fcatalog%2Fred-stripe.webp&w=600&q=80`)), { src: "/catalog/red-stripe.webp", width: 640, quality: 80 });
  assert.deepEqual(parseImageRequest(query(`src=%2Fapi%2Fmedia%2F${uuid}.jpg&w=1000`)), { src: `/api/media/${uuid}.jpg`, width: 1080, quality: 75 });
  assert.equal(parseImageRequest(query("src=%2Fcatalog%2Fred-stripe.webp&w=10&q=5")).quality, 40);
  assert.equal(parseImageRequest(query("src=%2Fcatalog%2Fred-stripe.webp&w=10&q=100")).quality, 90);
  for (const bad of ["", "w=640", "src=%2Fcatalog%2Fred-stripe.webp", "src=%2Fcatalog%2Fred-stripe.webp&w=0", "src=%2Fcatalog%2Fred-stripe.webp&w=-5",
    "src=%2Fcatalog%2Fred-stripe.webp&w=abc", "src=%2Fcatalog%2Fred-stripe.webp&w=1e3", "src=%2Fcatalog%2Fred-stripe.webp&w=100000", "src=%2Fcatalog%2Fred-stripe.webp&w=640&q=abc",
    "src=%2Fcatalog%2Fred-stripe.webp&w=640&q=-1", "src=%2Ficon.svg&w=640", "src=%2Fcatalog%2F..%2F..%2Fx.png&w=640", "src=https%3A%2F%2Fevil.example%2Fx.png&w=640"]) {
    assert.equal(parseImageRequest(query(bad)), null, bad);
  }
});

test("the browser-side loader rewrites photographs and leaves everything else alone", () => {
  assert.equal(imageUrl("/editorial/ve-man.png", 640), "/api/image?src=%2Feditorial%2Fve-man.png&w=640&q=75");
  assert.equal(imageUrl("/editorial/ve-man.png", 640, 60), "/api/image?src=%2Feditorial%2Fve-man.png&w=640&q=60");
  assert.equal(imageUrl("/icon.svg", 640), "/icon.svg");
  assert.equal(imageUrl("https://example.com/x.png", 640), "https://example.com/x.png");
  // What the loader writes is exactly what the route accepts.
  const url = new URL(imageUrl(`/api/media/${uuid}.webp`, 700, 70), "https://a.example");
  assert.deepEqual(parseImageRequest(url.searchParams), { src: `/api/media/${uuid}.webp`, width: 750, quality: 70 });
});
