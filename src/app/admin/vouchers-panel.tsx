"use client";

import { Copy, Ticket } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatGhs } from "@/lib/catalog";
import {
  formatVoucherCode, hardMaxPercent, maxCreateAtOnce, voucherState, type Voucher, type VoucherSettings,
} from "@/lib/voucher";
import styles from "./studio.module.css";

type AdminFetch = (path: string, init?: RequestInit) => Promise<unknown>;
type Filter = "all" | "active" | "used_up" | "expired" | "off";
type Notice = { kind: "ok" | "error"; text: string } | null;
type Loaded = { vouchers: Voucher[]; truncated: boolean; settings: VoucherSettings; now: string };

const stateText: Record<ReturnType<typeof voucherState>, string> = {
  active: "Working", used_up: "All used", expired: "Expired", waiting: "Starts later", off: "Turned off",
};
const stateTone: Record<ReturnType<typeof voucherState>, string> = {
  active: styles.pill_published, used_up: styles.pill_draft, expired: styles.pill_archived, waiting: styles.pill_todo, off: styles.pill_archived,
};

const json = { "Content-Type": "application/json" };
const day = (value: string) => new Date(value).toLocaleDateString("en-GH", { dateStyle: "medium" });
// Cedis typed by a person to pesewas for the server. Empty means "no limit".
const toMinor = (value: string): number | undefined => {
  const text = value.trim();
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : Number.NaN;
};

export function VouchersPanel({ adminFetch }: { adminFetch: AdminFetch }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [fresh, setFresh] = useState<Voucher[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [extending, setExtending] = useState<{ code: string; value: string } | null>(null);
  const [copied, setCopied] = useState("");
  // Settings form
  const [enabled, setEnabled] = useState(false);
  const [maxPercent, setMaxPercent] = useState("30");
  // Create form
  const [form, setForm] = useState({ label: "", percentOff: "10", quantity: "1", maxUses: "1", perCustomerLimit: "1", startsAt: "", expiresAt: "", minSpend: "", maxOff: "" });

  const load = useCallback(async () => {
    try {
      const result = await adminFetch("/api/admin/vouchers") as Loaded;
      setData(result); setLoadError("");
      setEnabled(result.settings.enabled); setMaxPercent(String(result.settings.maxPercent));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load vouchers");
    }
  }, [adminFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = useMemo(() => (data?.vouchers ?? []).filter((voucher) => {
    const state = voucherState(voucher, data?.now ?? new Date().toISOString());
    if (filter !== "all" && !(filter === state)) return false;
    const needle = query.trim().toLowerCase().replace(/[\s-]+/g, "");
    return !needle || voucher.code.toLowerCase().includes(needle) || voucher.label.toLowerCase().replace(/[\s-]+/g, "").includes(needle);
  }), [data, filter, query]);

  async function run<T>(action: () => Promise<T>, done: string): Promise<T | undefined> {
    setBusy(true); setNotice(null);
    try { const result = await action(); setNotice({ kind: "ok", text: done }); return result; }
    catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "That did not work" }); return undefined; }
    finally { setBusy(false); }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const percent = Number(maxPercent);
    await run(async () => {
      await adminFetch("/api/admin/voucher-settings", { method: "PUT", headers: json, body: JSON.stringify({ enabled, maxPercent: percent }) });
      await load();
    }, enabled ? "Settings saved. Vouchers are on." : "Settings saved. Vouchers are off.");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    const minSpend = toMinor(form.minSpend), maxOff = toMinor(form.maxOff);
    if (Number.isNaN(minSpend) || Number.isNaN(maxOff)) { setNotice({ kind: "error", text: "Money amounts must be numbers, for example 150 or 150.50." }); return; }
    const body = {
      label: form.label, percentOff: Number(form.percentOff), quantity: Number(form.quantity), maxUses: Number(form.maxUses),
      perCustomerLimit: Number(form.perCustomerLimit), expiresAt: form.expiresAt,
      ...(form.startsAt ? { startsAt: form.startsAt } : {}),
      ...(minSpend !== undefined ? { minSubtotalMinor: minSpend } : {}), ...(maxOff !== undefined ? { maxDiscountMinor: maxOff } : {}),
    };
    const result = await run(async () => {
      const response = await adminFetch("/api/admin/vouchers", { method: "POST", headers: json, body: JSON.stringify(body) }) as { vouchers: Voucher[] };
      await load();
      return response.vouchers;
    }, "Done. The new voucher numbers are shown below. Copy them now or find them in the list.");
    if (result) { setFresh(result); setForm({ ...form, label: "", quantity: "1" }); }
  }

  async function change(voucher: Voucher, patch: Record<string, unknown>, done: string) {
    await run(async () => {
      await adminFetch(`/api/admin/vouchers/${voucher.code}`, { method: "PATCH", headers: json, body: JSON.stringify(patch) });
      await load();
    }, done);
  }

  async function remove(voucher: Voucher) {
    await run(async () => {
      await adminFetch(`/api/admin/vouchers/${voucher.code}`, { method: "DELETE" });
      setConfirming(null);
      await load();
    }, "Voucher deleted.");
  }

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(""), 2500); }
    catch { setNotice({ kind: "error", text: "Your browser would not copy. Select the number and copy it by hand." }); }
  }

  if (loadError) return <section className={styles.page}><p role="alert" className={styles.lead}>{loadError}</p><button type="button" className={styles.secondary} onClick={() => void load()}>Try again</button></section>;
  if (!data) return <section className={styles.page}><p role="status" className={styles.lead}>Loading vouchers…</p></section>;

  const ceiling = Math.min(hardMaxPercent, data.settings.maxPercent);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  const counts = (state: Filter) => state === "all" ? data.vouchers.length : data.vouchers.filter((voucher) => voucherState(voucher, data.now) === state).length;

  return <section className={styles.page} aria-labelledby="vouchers-title">
    <div className={styles.pageHead}><div><p className={styles.kicker}>Settings</p><h1 id="vouchers-title">Vouchers</h1></div></div>
    <p className={styles.lead}>A voucher gives a percentage off the clothes (never the delivery). Customers type the voucher number at checkout. Each number is made by the system, so it cannot be guessed.</p>
    {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? styles.warn : styles.note}>{notice.text}</p>}

    <form className={styles.card} onSubmit={saveSettings}>
      <h2>Voucher settings</h2>
      <label className={styles.vSwitch}><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span><strong>{enabled ? "Vouchers are ON" : "Vouchers are OFF"}</strong><small>When off, no voucher works and the voucher box is hidden at checkout.</small></span></label>
      <label className={styles.vField}>Highest percentage allowed<input type="number" inputMode="numeric" min={1} max={hardMaxPercent} value={maxPercent} onChange={(event) => setMaxPercent(event.target.value)} /><small>Between 1 and {hardMaxPercent}. A safety limit: you cannot make a voucher above it, and any voucher already above it stops working.</small></label>
      <button className={styles.primary} type="submit" disabled={busy}>Save settings</button>
    </form>

    <form className={styles.card} onSubmit={create}>
      <h2>Make new vouchers</h2>
      <div className={styles.vGrid}>
        <label className={styles.vField} style={{ gridColumn: "1 / -1" }}>Note for you<input value={form.label} onChange={set("label")} maxLength={80} required placeholder="For example: Ama, Instagram giveaway" /><small>Only you see this. Customers never do.</small></label>
        <label className={styles.vField}>Percentage off<input type="number" inputMode="numeric" min={1} max={ceiling} value={form.percentOff} onChange={set("percentOff")} required /><small>Up to {ceiling}%. It cannot be changed later.</small></label>
        <label className={styles.vField}>How many numbers to make<input type="number" inputMode="numeric" min={1} max={maxCreateAtOnce} value={form.quantity} onChange={set("quantity")} required /><small>Each one gets its own number.</small></label>
        <label className={styles.vField}>Times each can be used<input type="number" inputMode="numeric" min={1} value={form.maxUses} onChange={set("maxUses")} required /><small>1 is the safest: one customer, one use.</small></label>
        <label className={styles.vField}>Times per phone number<input type="number" inputMode="numeric" min={1} max={Number(form.maxUses) || 1} value={form.perCustomerLimit} onChange={set("perCustomerLimit")} required /><small>How often one phone number can use it.</small></label>
        <label className={styles.vField}>First day (optional)<input type="date" value={form.startsAt} onChange={set("startsAt")} /></label>
        <label className={styles.vField}>Last day<input type="date" value={form.expiresAt} onChange={set("expiresAt")} required /><small>Required. At most about a year ahead.</small></label>
        <label className={styles.vField}>Smallest order (GH₵, optional)<input inputMode="decimal" value={form.minSpend} onChange={set("minSpend")} placeholder="No minimum" /><small>The clothes must cost at least this much.</small></label>
        <label className={styles.vField}>Most it can take off (GH₵, optional)<input inputMode="decimal" value={form.maxOff} onChange={set("maxOff")} placeholder="No limit" /><small>Stops a big order getting a huge discount.</small></label>
      </div>
      <button className={styles.primary} type="submit" disabled={busy}><Ticket size={16} aria-hidden="true" />{Number(form.quantity) > 1 ? `Make ${form.quantity} vouchers` : "Make voucher"}</button>
    </form>

    {fresh.length > 0 && <div className={styles.card} aria-live="polite">
      <h2>New voucher numbers</h2>
      <p>Give each number to one customer. Keep this list safe: anyone with a number can use it.</p>
      <ul className={styles.vCodes}>{fresh.map((voucher) => <li key={voucher.code}><code>{formatVoucherCode(voucher.code)}</code><button type="button" className={styles.secondary} onClick={() => void copy(formatVoucherCode(voucher.code), voucher.code)}><Copy size={14} aria-hidden="true" />{copied === voucher.code ? "Copied" : "Copy"}</button></li>)}</ul>
      {fresh.length > 1 && <button type="button" className={styles.secondary} onClick={() => void copy(fresh.map((voucher) => formatVoucherCode(voucher.code)).join("\n"), "all")}>{copied === "all" ? "Copied" : "Copy all numbers"}</button>}
    </div>}

    <div className={styles.card}>
      <h2>Your vouchers</h2>
      {data.truncated && <p className={styles.note}>Showing the newest 500.</p>}
      <div className={styles.filters} role="group" aria-label="Show vouchers">
        {([["all", "All"], ["active", "Working"], ["used_up", "All used"], ["expired", "Expired"], ["off", "Turned off"]] as [Filter, string][]).map(([id, label]) =>
          <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} {counts(id)}</button>)}
      </div>
      <label className={styles.orderSearch}><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find by voucher number or note" aria-label="Find a voucher" autoComplete="off" /></label>
      {data.vouchers.length === 0 ? <p>No vouchers yet. Make one above.</p> : rows.length === 0 ? <p>No voucher matches.</p> :
        <ul className={styles.vList}>{rows.map((voucher) => {
          const state = voucherState(voucher, data.now);
          const used = voucher.redeemed, waiting = voucher.reserved;
          const unused = used + waiting === 0;
          return <li key={voucher.code}>
            <div className={styles.vMain}>
              <div className={styles.vTop}><code>{formatVoucherCode(voucher.code)}</code><button type="button" className={styles.vCopy} onClick={() => void copy(formatVoucherCode(voucher.code), voucher.code)} aria-label={`Copy ${formatVoucherCode(voucher.code)}`}><Copy size={14} aria-hidden="true" /> {copied === voucher.code ? "Copied" : "Copy"}</button><em className={stateTone[state]}>{stateText[state]}</em></div>
              <strong>{voucher.percentOff}% off</strong> · {voucher.label}
              <small>Used {used} of {voucher.maxUses}{waiting > 0 ? ` (${waiting} waiting for payment)` : ""} · {voucher.perCustomerLimit} per phone number · {voucher.startsAt ? `from ${day(voucher.startsAt)} ` : ""}until {day(voucher.expiresAt)}{voucher.minSubtotalMinor > 0 ? ` · orders of ${formatGhs(voucher.minSubtotalMinor)} or more` : ""}{voucher.maxDiscountMinor ? ` · takes off at most ${formatGhs(voucher.maxDiscountMinor)}` : ""}</small>
            </div>
            <div className={styles.vActions}>
              {extending?.code === voucher.code ? <div className={styles.confirm}>
                <input type="date" value={extending.value} onChange={(event) => setExtending({ code: voucher.code, value: event.target.value })} aria-label="New last day" />
                <button type="button" className={styles.primary} disabled={busy || !extending.value} onClick={() => { void change(voucher, { expiresAt: extending.value }, "Last day changed."); setExtending(null); }}>Save</button>
                <button type="button" className={styles.secondary} onClick={() => setExtending(null)}>Cancel</button>
              </div> : confirming === voucher.code ? <div className={styles.confirm} role="alertdialog" aria-label={`Delete ${formatVoucherCode(voucher.code)}`}>
                <span>Delete this voucher for good?</span>
                <button type="button" className={styles.danger} disabled={busy} onClick={() => void remove(voucher)}>Delete</button>
                <button type="button" className={styles.secondary} onClick={() => setConfirming(null)}>Keep</button>
              </div> : <>
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => void change(voucher, { active: !voucher.active }, voucher.active ? "Voucher turned off." : "Voucher turned on.")}>{voucher.active ? "Turn off" : "Turn on"}</button>
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => setExtending({ code: voucher.code, value: voucher.expiresAt.slice(0, 10) })}>Change last day</button>
                {unused && <button type="button" className={styles.secondary} disabled={busy} onClick={() => setConfirming(voucher.code)}>Delete</button>}
              </>}
            </div>
          </li>;
        })}</ul>}
    </div>
  </section>;
}
