// Sales summary for the admin Insights screen, worked out from the orders the
// admin has already loaded, so it costs no extra database reads. Only paid
// orders count as sales, dated by when payment was confirmed. Ghana keeps
// UTC all year, so calendar days are UTC days.

export type InsightsPeriod = "today" | "7d" | "30d" | "month";

export const insightsPeriods: { id: InsightsPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
];

export interface InsightsOrder {
  status: string;
  createdAt: string;
  paidAt: string | null;
  delivery: { zoneLabel: string };
  lines: { slug: string; name: string; size: string; quantity: number; lineTotalMinor: number }[];
  discountMinor?: number;
  voucher?: { code: string } | null;
  deliveryFeeMinor: number;
  totalMinor: number;
}

export interface RankedRow { key: string; label: string; count: number; amountMinor: number }

export interface SalesSummary {
  salesMinor: number;
  orders: number;
  averageMinor: number;
  pieces: number;
  deliveryFeesMinor: number;
  discountsMinor: number;
  vouchersUsed: number;
  /** Checkouts started in the period that were never paid (abandoned, failed or expired). */
  unpaidCheckouts: number;
  /** Paid orders waiting for a manual check. Not counted as sales. */
  needsReview: number;
  /** The same figure for the period just before, for comparison; null for "this month". */
  previousSalesMinor: number | null;
  topProducts: RankedRow[];
  topSizes: RankedRow[];
  areas: RankedRow[];
}

const day = 24 * 60 * 60 * 1000;

/** Start (inclusive) and end (exclusive) of a period, and of the period before it. */
export function periodRange(period: InsightsPeriod, now: Date): { start: number; end: number; previousStart: number | null } {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = today + day;
  if (period === "month") return { start: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1), end, previousStart: null };
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  const start = end - days * day;
  return { start, end, previousStart: start - days * day };
}

function time(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? NaN : parsed;
}

function rank(map: Map<string, RankedRow>, limit: number): RankedRow[] {
  return [...map.values()].sort((a, b) => b.count - a.count || b.amountMinor - a.amountMinor || a.label.localeCompare(b.label)).slice(0, limit);
}

function bump(map: Map<string, RankedRow>, key: string, label: string, count: number, amountMinor: number) {
  const row = map.get(key) ?? { key, label, count: 0, amountMinor: 0 };
  row.count += count; row.amountMinor += amountMinor;
  map.set(key, row);
}

const unpaidStatuses = new Set(["initializing", "pending_payment", "failed", "expired"]);

export function summarizeSales(orders: InsightsOrder[], period: InsightsPeriod, now = new Date()): SalesSummary {
  const { start, end, previousStart } = periodRange(period, now);
  const inRange = (at: number, from: number, to: number) => at >= from && at < to;
  const products = new Map<string, RankedRow>();
  const sizes = new Map<string, RankedRow>();
  const areas = new Map<string, RankedRow>();
  const summary: SalesSummary = {
    salesMinor: 0, orders: 0, averageMinor: 0, pieces: 0, deliveryFeesMinor: 0, discountsMinor: 0, vouchersUsed: 0,
    unpaidCheckouts: 0, needsReview: 0, previousSalesMinor: previousStart === null ? null : 0, topProducts: [], topSizes: [], areas: [],
  };

  for (const order of orders) {
    const created = time(order.createdAt);
    if (order.status === "paid") {
      const paid = time(order.paidAt ?? order.createdAt);
      if (previousStart !== null && inRange(paid, previousStart, start)) summary.previousSalesMinor! += order.totalMinor;
      if (!inRange(paid, start, end)) continue;
      summary.salesMinor += order.totalMinor;
      summary.orders += 1;
      summary.deliveryFeesMinor += order.deliveryFeeMinor;
      summary.discountsMinor += order.discountMinor ?? 0;
      if (order.voucher?.code) summary.vouchersUsed += 1;
      const area = order.delivery?.zoneLabel?.trim() || "Not given";
      bump(areas, area, area, 1, order.totalMinor);
      for (const line of order.lines) {
        summary.pieces += line.quantity;
        bump(products, line.slug, line.name, line.quantity, line.lineTotalMinor);
        bump(sizes, line.size, line.size, line.quantity, line.lineTotalMinor);
      }
    } else if (inRange(created, start, end)) {
      if (order.status === "review_required") summary.needsReview += 1;
      else if (unpaidStatuses.has(order.status)) summary.unpaidCheckouts += 1;
    }
  }

  summary.averageMinor = summary.orders ? Math.round(summary.salesMinor / summary.orders) : 0;
  summary.topProducts = rank(products, 5);
  summary.topSizes = rank(sizes, 6);
  summary.areas = rank(areas, 6);
  return summary;
}

/** "+12%" / "−5%" against the previous period, or null when there is nothing to compare. */
export function changeLabel(current: number, previous: number | null): string | null {
  if (previous === null || previous === 0) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  return percent === 0 ? "Same as before" : `${percent > 0 ? "+" : "−"}${Math.abs(percent)}%`;
}
