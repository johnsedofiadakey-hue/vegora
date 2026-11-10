import test from "node:test";
import assert from "node:assert/strict";
import { changeLabel, periodRange, summarizeSales } from "../src/lib/sales-insights.ts";

const now = new Date("2026-11-10T15:00:00Z");

function order(status, at, extra = {}) {
  return {
    status, createdAt: at, paidAt: status === "paid" ? at : null,
    delivery: { zoneLabel: "Accra" },
    lines: [{ slug: "navy-tee", name: "Navy Tee", size: "M", quantity: 1, lineTotalMinor: 18000 }],
    deliveryFeeMinor: 3000, totalMinor: 21000, ...extra,
  };
}

test("periods are whole Ghana (UTC) days, with the period before for comparison", () => {
  const today = periodRange("today", now);
  assert.equal(new Date(today.start).toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(new Date(today.end).toISOString(), "2026-11-11T00:00:00.000Z");
  assert.equal(new Date(today.previousStart).toISOString(), "2026-11-09T00:00:00.000Z");
  const week = periodRange("7d", now);
  assert.equal(new Date(week.start).toISOString(), "2026-11-04T00:00:00.000Z");
  const month = periodRange("month", now);
  assert.equal(new Date(month.start).toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(month.previousStart, null);
});

test("only paid orders count as sales, dated by payment", () => {
  const orders = [
    order("paid", "2026-11-10T09:00:00Z"),
    order("paid", "2026-11-10T11:00:00Z", { totalMinor: 39000, discountMinor: 1800, voucher: { code: "ABC" },
      delivery: { zoneLabel: "Kumasi" },
      lines: [{ slug: "navy-tee", name: "Navy Tee", size: "L", quantity: 2, lineTotalMinor: 36000 }] }),
    order("paid", "2026-11-09T11:00:00Z"),
    order("pending_payment", "2026-11-10T12:00:00Z"),
    order("failed", "2026-11-10T12:30:00Z"),
    order("review_required", "2026-11-10T13:00:00Z"),
  ];
  const today = summarizeSales(orders, "today", now);
  assert.equal(today.salesMinor, 60000);
  assert.equal(today.orders, 2);
  assert.equal(today.averageMinor, 30000);
  assert.equal(today.pieces, 3);
  assert.equal(today.deliveryFeesMinor, 6000);
  assert.equal(today.discountsMinor, 1800);
  assert.equal(today.vouchersUsed, 1);
  assert.equal(today.unpaidCheckouts, 2);
  assert.equal(today.needsReview, 1);
  assert.equal(today.previousSalesMinor, 21000);
  assert.deepEqual(today.topProducts, [{ key: "navy-tee", label: "Navy Tee", count: 3, amountMinor: 54000 }]);
  assert.deepEqual(today.topSizes.map((row) => [row.label, row.count]), [["L", 2], ["M", 1]]);
  assert.deepEqual(today.areas.map((row) => [row.label, row.count]), [["Kumasi", 1], ["Accra", 1]]); // a tie goes to the area that brought in more
});

test("an order paid today but started yesterday counts today", () => {
  const late = { ...order("paid", "2026-11-09T23:50:00Z"), paidAt: "2026-11-10T00:05:00Z" };
  assert.equal(summarizeSales([late], "today", now).orders, 1);
});

test("an empty shop gives zeros, not errors", () => {
  const empty = summarizeSales([], "30d", now);
  assert.equal(empty.salesMinor, 0);
  assert.equal(empty.averageMinor, 0);
  assert.deepEqual(empty.topProducts, []);
});

test("the change label compares with the period before", () => {
  assert.equal(changeLabel(120, 100), "+20%");
  assert.equal(changeLabel(95, 100), "−5%");
  assert.equal(changeLabel(100, 100), "Same as before");
  assert.equal(changeLabel(100, 0), null);
  assert.equal(changeLabel(100, null), null);
});
