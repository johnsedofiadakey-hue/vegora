"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { cedisToMinor, defaultRegion, maxAreaLabel, maxDeliveryAreas, maxDeliveryFeeMinor, type DeliveryArea } from "@/lib/delivery";
import styles from "./studio.module.css";

type AdminFetch = (path: string, init?: RequestInit) => Promise<unknown>;
type Notice = { kind: "ok" | "error"; text: string } | null;
type Loaded = { areas: DeliveryArea[]; source: "admin" | "server"; updatedAt: string | null };
// One editable row. "id" is empty for an area that has not been saved yet.
type Row = { key: number; id: string; label: string; region: string; fee: string; active: boolean };

const json = { "Content-Type": "application/json" };
let nextKey = 1;
const toRow = (area: DeliveryArea): Row => ({ key: nextKey++, id: area.id, label: area.label, region: area.region, fee: (area.feeMinor / 100).toFixed(2).replace(/\.00$/, ""), active: area.active });
const blankRow = (): Row => ({ key: nextKey++, id: "", label: "", region: defaultRegion, fee: "", active: true });

export function DeliveryPanel({ adminFetch }: { adminFetch: AdminFetch }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await adminFetch("/api/admin/delivery") as Loaded;
      setData(result); setRows(result.areas.map(toRow)); setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load delivery areas");
    }
  }, [adminFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const change = (key: number, patch: Partial<Row>) => setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));

  async function save(event: FormEvent) {
    event.preventDefault();
    const areas = [];
    for (const row of rows) {
      const feeMinor = cedisToMinor(row.fee);
      if (!row.label.trim()) { setNotice({ kind: "error", text: "Every area needs a name." }); return; }
      if (Number.isNaN(feeMinor)) { setNotice({ kind: "error", text: `Check the price for ${row.label.trim()}. Type it in cedis, for example 30 or 45.50. Type 0 for free delivery.` }); return; }
      areas.push({ ...(row.id ? { id: row.id } : {}), label: row.label, region: row.region, feeMinor, active: row.active });
    }
    setBusy(true); setNotice(null);
    try {
      const result = await adminFetch("/api/admin/delivery", { method: "PUT", headers: json, body: JSON.stringify({ areas }) }) as Loaded;
      setData(result); setRows(result.areas.map(toRow));
      setNotice({ kind: "ok", text: "Saved. The new prices work for new orders straight away. Orders already placed keep the price they were made with." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "That did not save" });
    } finally { setBusy(false); }
  }

  if (loadError) return <section className={styles.page}><p role="alert" className={styles.lead}>{loadError}</p><button type="button" className={styles.secondary} onClick={() => void load()}>Try again</button></section>;
  if (!data) return <section className={styles.page}><p role="status" className={styles.lead}>Loading delivery areas…</p></section>;

  const onCount = rows.filter((row) => row.active).length;

  return <section className={styles.page} aria-labelledby="delivery-title">
    <div className={styles.pageHead}><div><p className={styles.kicker}>Settings</p><h1 id="delivery-title">Delivery</h1></div></div>
    <p className={styles.lead}>These are the places you deliver to and what each one costs. Customers pick one at checkout and the price is added to their order.</p>
    {data.source === "server" && <p className={styles.note}>These are your starting areas. Change anything below and press Save, and you can manage them here from now on.</p>}

    <form className={styles.card} onSubmit={save}>
      <h2>Delivery areas</h2>
      <ul className={styles.dRows}>{rows.map((row, index) => <li key={row.key} className={row.active ? undefined : styles.dOff}>
        <label className={styles.vField}>Area name<input value={row.label} maxLength={maxAreaLabel} onChange={(event) => change(row.key, { label: event.target.value })} placeholder="For example: East Legon" required /></label>
        <label className={styles.vField}>Price (GH₵)<input inputMode="decimal" value={row.fee} onChange={(event) => change(row.key, { fee: event.target.value })} placeholder="30" required aria-describedby={`fee-help-${row.key}`} /><small id={`fee-help-${row.key}`}>0 means free delivery. Most you can enter: {maxDeliveryFeeMinor / 100}.</small></label>
        <label className={styles.vField}>Region<input value={row.region} maxLength={60} onChange={(event) => change(row.key, { region: event.target.value })} /><small>Shown on the order.</small></label>
        <div className={styles.dActions}>
          <label className={styles.vSwitch}><input type="checkbox" checked={row.active} onChange={(event) => change(row.key, { active: event.target.checked })} /><span><strong>{row.active ? "On" : "Off"}</strong><small>{row.active ? "Customers can choose it." : "Customers cannot choose it."}</small></span></label>
          {rows.length > 1 && <button type="button" className={styles.secondary} onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} aria-label={`Remove ${row.label || `area ${index + 1}`}`}><Trash2 size={14} aria-hidden="true" /> Remove</button>}
        </div>
      </li>)}</ul>
      {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? styles.warn : styles.note}>{notice.text}</p>}
      {onCount === 0 && <p role="alert" className={styles.warn}>Keep at least one area switched on, or customers cannot order.</p>}
      <div className={styles.dButtons}>
        {rows.length < maxDeliveryAreas && <button type="button" className={styles.secondary} onClick={() => setRows((current) => [...current, blankRow()])}><Plus size={14} aria-hidden="true" /> Add an area</button>}
        <button className={styles.primary} type="submit" disabled={busy || onCount === 0}>{busy ? "Saving…" : "Save delivery areas"}</button>
      </div>
      <p className={styles.fieldNote}>Nothing changes on the shop until you press Save. Removing or turning off an area never changes orders already placed.{data.updatedAt ? ` Last saved ${new Date(data.updatedAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}.` : ""}</p>
    </form>
  </section>;
}
