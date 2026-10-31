import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createImageCache, resizeToWebp } from "../src/lib/server/image-resize.ts";

const jpeg = (width, height, options = {}) => sharp({ create: { width, height, channels: 3, background: { r: 120, g: 30, b: 50 } } }).withMetadata(options).jpeg().toBuffer();

test("a large photograph becomes a smaller WebP at the standard width", async () => {
  const original = await jpeg(2400, 3200);
  const resized = await resizeToWebp(original, 640, 75);
  const info = await sharp(resized).metadata();
  assert.equal(info.format, "webp");
  assert.equal(info.width, 640);
  assert.equal(info.height, 853);
  assert.ok(resized.length < original.length);
});

test("a photograph is never enlarged", async () => {
  const info = await sharp(await resizeToWebp(await jpeg(100, 150), 640, 75)).metadata();
  assert.equal(info.width, 100);
});

test("a phone's rotation flag is applied, and GPS location is not passed on", async () => {
  const flagged = await jpeg(200, 100, { orientation: 6, exif: { IFD0: { Copyright: "private" } } });
  const info = await sharp(await resizeToWebp(flagged, 640, 75)).metadata();
  assert.equal(info.width, 100);
  assert.equal(info.height, 200);
  assert.equal(info.exif, undefined);
});

test("a file that is not a photograph is refused, so the route can send the original", async () => {
  await assert.rejects(resizeToWebp(Buffer.from("not an image at all"), 640, 75));
  await assert.rejects(resizeToWebp(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]), 640, 75));
});

test("the cache forgets the least recently used photographs first", () => {
  const cache = createImageCache(100, 10);
  cache.set("a", Buffer.alloc(40));
  cache.set("b", Buffer.alloc(40));
  assert.ok(cache.get("a"));
  cache.set("c", Buffer.alloc(40));
  assert.equal(cache.get("b"), undefined);
  assert.ok(cache.get("a") && cache.get("c"));
  cache.set("huge", Buffer.alloc(500));
  assert.equal(cache.get("huge"), undefined);
  const counted = createImageCache(10_000, 3);
  for (const key of ["1", "2", "3", "4", "5"]) counted.set(key, Buffer.alloc(1));
  assert.equal(counted.size, 3);
  assert.equal(counted.get("1"), undefined);
  assert.ok(counted.get("5"));
});
