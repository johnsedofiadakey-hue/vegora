"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { formatGhs } from "@/lib/catalog";
import { changeLabel, insightsPeriods, summarizeSales, type InsightsOrder, type InsightsPeriod, type RankedRow } from "@/lib/sales-insights";
import { gaConfigured } from "@/lib/google-analytics";
import { pixelId } from "@/lib/meta-pixel";
import styles from "./studio.module.css";

const previousLabel: Record<InsightsPeriod, string> = { today: "yesterday", "7d": "the 7 days before", "30d": "the 30 days before", month: "" };

function Ranked({ title, rows, unit, empty }: { title: string; rows: RankedRow[]; unit: [string, string]; empty: string }) {
  const top = rows[0]?.count || 1;
  return <div className={styles.card}>
    <h2>{title}</h2>
    {rows.length === 0 ? <p className={styles.insightEmpty}>{empty}</p>
      : <ol className={styles.rankList}>{rows.map((row) => <li key={row.key}>
        <div><strong>{row.label}</strong><span>{row.count} {row.count === 1 ? unit[0] : unit[1]} · {formatGhs(row.amountMinor)}</span></div>
        <i style={{ width: `${Math.max(6, Math.round((row.count / top) * 100))}%` }} aria-hidden="true" />
      </li>)}</ol>}
  </div>;
}

/** Sales at a glance from the loaded orders, plus links to Google Analytics and Meta for visitors and ads. */
export function InsightsPanel({ orders, truncated, busy, onRefresh }: { orders: InsightsOrder[]; truncated: boolean; busy: boolean; onRefresh: () => void }) {
  const [period, setPeriod] = useState<InsightsPeriod>("7d");
  const summary = useMemo(() => summarizeSales(orders, period), [orders, period]);
  const change = changeLabel(summary.salesMinor, summary.previousSalesMinor);
  const pixelLink = /^[0-9]{10,20}$/.test(pixelId) ? `https://business.facebook.com/events_manager2/list/pixel/${pixelId}/overview` : null;

  return <section className={styles.page} aria-labelledby="insights-title">
    <div className={styles.pageHead}>
      <div><p className={styles.kicker}>Insights</p><h1 id="insights-title">How the shop is doing</h1></div>
      <button type="button" className={styles.secondary} disabled={busy} onClick={onRefresh}><RefreshCw size={15} aria-hidden="true" />Refresh</button>
    </div>
    <p className={styles.lead}>Sales from paid orders. Visitors and adverts are in Google Analytics and Meta, linked at the bottom.</p>

    <div className={styles.periodTabs} role="group" aria-label="Period">
      {insightsPeriods.map((item) => <button type="button" key={item.id} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}
    </div>
    {truncated && <p className={styles.insightNote}>Only the latest 200 orders are loaded, so longer periods may be missing older sales.</p>}

    <dl className={styles.statGrid}>
      <div className={styles.statMain}><dt>Sales</dt><dd>{formatGhs(summary.salesMinor)}</dd>
        {change && <small>{change} vs {previousLabel[period]}</small>}</div>
      <div><dt>Paid orders</dt><dd>{summary.orders}</dd></div>
      <div><dt>Average order</dt><dd>{summary.orders ? formatGhs(summary.averageMinor) : "—"}</dd></div>
      <div><dt>Pieces sold</dt><dd>{summary.pieces}</dd></div>
    </dl>
    <p className={styles.insightNote}>
      Sales include {formatGhs(summary.deliveryFeesMinor)} in delivery fees
      {summary.discountsMinor > 0 ? <> and are after {formatGhs(summary.discountsMinor)} of voucher discounts ({summary.vouchersUsed} {summary.vouchersUsed === 1 ? "voucher" : "vouchers"} used)</> : null}.
      {summary.unpaidCheckouts > 0 && <> {summary.unpaidCheckouts} {summary.unpaidCheckouts === 1 ? "checkout was" : "checkouts were"} started but not paid.</>}
      {summary.needsReview > 0 && <> <strong>{summary.needsReview} {summary.needsReview === 1 ? "order needs" : "orders need"} a check in Orders.</strong></>}
    </p>

    <div className={styles.insightGrid}>
      <Ranked title="Best sellers" rows={summary.topProducts} unit={["piece", "pieces"]} empty="No sales in this period yet." />
      <Ranked title="Sizes sold" rows={summary.topSizes} unit={["piece", "pieces"]} empty="No sales in this period yet." />
      <Ranked title="Delivery areas" rows={summary.areas} unit={["order", "orders"]} empty="No sales in this period yet." />
    </div>

    <div className={styles.card}>
      <h2>Visitors and adverts</h2>
      <p>How many people visit, where they come from and which adverts work are measured by Google and Meta. Open them here.</p>
      <div className={styles.insightLinks}>
        {gaConfigured && <a className={styles.secondary} href="https://analytics.google.com/analytics/web/" target="_blank" rel="noreferrer">Google Analytics<ArrowUpRight size={15} aria-hidden="true" /></a>}
        {pixelLink && <a className={styles.secondary} href={pixelLink} target="_blank" rel="noreferrer">Meta Events Manager<ArrowUpRight size={15} aria-hidden="true" /></a>}
        {!gaConfigured && !pixelLink && <span className={styles.insightEmpty}>No tracking is set up yet.</span>}
      </div>
      <small className={styles.fieldNote}>Sign in with the Google or Facebook account that owns them. In Google Analytics, Reports → Realtime shows who is on the site right now.</small>
    </div>
  </section>;
}
