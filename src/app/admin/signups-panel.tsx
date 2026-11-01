"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signupInterests, signupsToCsv, type SignupInterest } from "@/lib/signup";
import styles from "./admin.module.css";

type AdminFetch = (path: string, init?: RequestInit) => Promise<unknown>;

interface SignupRow {
  id: string;
  email: string;
  name: string;
  phone: string;
  interests: SignupInterest[];
  message: string;
  createdAt: string;
  updatedAt: string;
  count: number;
}

type Filter = "all" | SignupInterest;
type Notice = { kind: "ok" | "error"; text: string } | null;

const labelOf = new Map<string, string>(signupInterests.map((interest) => [interest.id, interest.label]));

function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" });
}

export function SignupsPanel({ adminFetch }: { adminFetch: AdminFetch }) {
  const [rows, setRows] = useState<SignupRow[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [manualCopy, setManualCopy] = useState("");
  const manualBox = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await adminFetch("/api/admin/signups") as { signups: SignupRow[]; truncated: boolean };
      setRows(result.signups); setTruncated(result.truncated); setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load sign-ups");
    }
  }, [adminFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const shown = useMemo(() => (rows ?? []).filter((row) => filter === "all" || row.interests.includes(filter)), [rows, filter]);
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: rows?.length ?? 0 };
    for (const interest of signupInterests) result[interest.id] = (rows ?? []).filter((row) => row.interests.includes(interest.id)).length;
    return result;
  }, [rows]);

  async function copyEmails() {
    const text = shown.map((row) => row.email).join(", ");
    setManualCopy("");
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ kind: "ok", text: `Copied ${shown.length} email ${shown.length === 1 ? "address" : "addresses"}.` });
    } catch {
      // Some browsers refuse clipboard access: show the list so it can be copied by hand.
      setManualCopy(text);
      setNotice({ kind: "ok", text: "Your browser did not allow copying, so the addresses are shown below. Select them and copy." });
      window.setTimeout(() => manualBox.current?.select(), 0);
    }
  }

  function downloadCsv() {
    const blob = new Blob(["﻿", signupsToCsv(shown)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vegora-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ kind: "ok", text: `Downloaded ${shown.length} ${shown.length === 1 ? "person" : "people"} as a spreadsheet file.` });
  }

  async function remove(row: SignupRow) {
    setBusy(true); setNotice(null);
    try {
      await adminFetch(`/api/admin/signups/${encodeURIComponent(row.id)}`, { method: "DELETE" });
      setRows((current) => current && current.filter((item) => item.id !== row.id));
      setNotice({ kind: "ok", text: `${row.email} was removed from the list.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Unable to remove this person" });
    } finally { setBusy(false); setConfirming(null); }
  }

  if (loadError) return <section className={styles.signups}><p role="alert" className={styles.message}>{loadError}</p><div className={styles.actions}><button type="button" onClick={() => void load()}>Try again</button></div></section>;
  if (!rows) return <section className={styles.signups}><p role="status" className={styles.message}>Loading sign-ups…</p></section>;

  return <section className={styles.signups} aria-labelledby="signups-title">
    <div className={styles.editorTop}>
      <div><p className={styles.eyebrow}>FOOTER SIGN-UPS</p><h1 id="signups-title">Sign-ups</h1></div>
      <span className={styles.status}>{rows.length} {rows.length === 1 ? "person" : "people"}</span>
    </div>
    <p className={styles.hint}>People who used the form in the website footer. Nothing is emailed to them automatically yet, so use this list to follow up with deals, customization and bulk-order requests.</p>
    {truncated && <p role="status" className={styles.message}>Showing the newest 500 sign-ups. Older ones are not listed here yet.</p>}
    {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={styles.message}>{notice.text}</p>}

    <div className={styles.filters} role="group" aria-label="Filter by interest">
      {([["all", "Everyone"], ...signupInterests.map((interest) => [interest.id, interest.label] as const)] as const).map(([id, label]) =>
        <button type="button" key={id} aria-pressed={filter === id} onClick={() => { setFilter(id as Filter); setConfirming(null); }}>{label} <span>{counts[id]}</span></button>)}
    </div>
    <div className={styles.actions}>
      <button type="button" disabled={shown.length === 0} onClick={() => void copyEmails()}>Copy emails</button>
      <button type="button" className={styles.archive} disabled={shown.length === 0} onClick={downloadCsv}>Download spreadsheet</button>
      <button type="button" className={styles.archive} disabled={busy} onClick={() => void load()}>Refresh</button>
    </div>
    {manualCopy && <textarea ref={manualBox} className={styles.manualCopy} readOnly rows={4} value={manualCopy} aria-label="Email addresses to copy" />}

    {rows.length === 0
      ? <div className={styles.emptyState}><h2>No sign-ups yet.</h2><p>When someone uses the form in the website footer, they will appear here.</p></div>
      : shown.length === 0
        ? <div className={styles.emptyState}><h2>No one in this group yet.</h2></div>
        : <ul className={styles.signupList}>{shown.map((row) => <li key={row.id}>
          <div className={styles.signupMain}>
            <strong>{row.name || row.email}</strong>
            {row.name && <span>{row.email}</span>}
            {row.phone && <span>{row.phone}</span>}
            <div className={styles.interestTags}>{row.interests.map((interest) => <em key={interest}>{labelOf.get(interest) ?? interest}</em>)}</div>
            {row.message && <p className={styles.signupNote}>{row.message}</p>}
          </div>
          <div className={styles.signupSide}>
            <small>Signed up {when(row.createdAt)}{row.count > 1 ? ` · submitted ${row.count} times, latest ${when(row.updatedAt)}` : ""}</small>
            {confirming === row.id
              ? <div className={styles.inlineConfirm} role="alertdialog" aria-label={`Remove ${row.email}`}>
                <span>Remove this person from the list?</span>
                <button type="button" disabled={busy} onClick={() => void remove(row)}>{busy ? "Removing…" : "Remove"}</button>
                <button type="button" className={styles.archive} disabled={busy} onClick={() => setConfirming(null)}>Keep</button>
              </div>
              : <button type="button" className={styles.textLink} onClick={() => setConfirming(row.id)}>Remove</button>}
          </div>
        </li>)}</ul>}
  </section>;
}
