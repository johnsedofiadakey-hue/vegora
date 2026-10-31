"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  approvedEditorialImages, maxUploadBytes, uploadMimeTypes,
  type BlockId, type BlockStatus, type ContentValues, type FieldKind, type FieldValue, type ImageValue,
} from "@/lib/site-content";
import styles from "./admin.module.css";

type AdminFetch = (path: string, init?: RequestInit) => Promise<unknown>;

interface FieldSpec {
  key: string;
  kind: FieldKind;
  label: string;
  help?: string;
  max?: number;
  required?: boolean;
}

interface RevisionView { id: string; version: number; publishedAt: string; publishedBy: string }

interface BlockView {
  id: BlockId;
  label: string;
  description: string;
  fields: FieldSpec[];
  status: BlockStatus;
  version: number;
  values: ContentValues;
  published: ContentValues;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
  revisions?: RevisionView[];
}

interface ProductChoice { slug: string; name: string; status: string }

type Notice = { kind: "ok" | "error"; text: string } | null;
type Confirm = "publish" | "discard" | null;

const statusLabel: Record<BlockStatus, string> = {
  default: "Built-in text",
  draft: "Draft, not live",
  published: "Live",
  changed: "Live, unpublished changes",
};

const siteImageLabels: Record<string, string> = {
  "/editorial/ve-man.png": "Man in black tailoring",
  "/editorial/ve-man-coat.png": "Man in a black overcoat",
  "/editorial/ve-woman.png": "Woman in black tailoring",
  "/editorial/ve-woman-light.png": "Woman in a white tailored jacket",
  "/editorial/ve-detail.png": "Tailoring detail",
};

// Where an owner can see each section once it is live.
const livePage: Record<BlockId, string> = {
  announcement: "/", home: "/", edit: "/the-edit", about: "/about", contact: "/", delivery: "/delivery", returns: "/returns", privacy: "/privacy", terms: "/terms",
};

function sameValues(fields: FieldSpec[], a: ContentValues, b: ContentValues): boolean {
  return fields.every((field) => JSON.stringify(a[field.key]) === JSON.stringify(b[field.key]));
}

function describeProblems(fields: FieldSpec[], values: ContentValues): string[] {
  const problems: string[] = [];
  for (const field of fields) {
    const value = values[field.key];
    if (field.kind === "image") {
      const image = value as ImageValue;
      if (!image.alt.trim()) problems.push(`${field.label}: add a description of the photograph`);
    } else if (field.required && typeof value === "string" && !value.trim()) {
      problems.push(`${field.label} cannot be empty`);
    }
  }
  if (typeof values.enabled === "boolean" && values.enabled && typeof values.text === "string" && !values.text.trim()) {
    problems.push("Add a message before switching the announcement bar on");
  }
  return problems;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ContentEditor({ adminFetch }: { adminFetch: AdminFetch }) {
  const [blocks, setBlocks] = useState<BlockView[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<BlockId | null>(null);
  const [edits, setEdits] = useState<Partial<Record<BlockId, ContentValues>>>({});
  const [products, setProducts] = useState<ProductChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [conflict, setConflict] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadingFor = useRef<string | null>(null);

  // Fetches one section's full detail, including its earlier versions, and
  // merges it in. Unsaved edits are kept; only what the server holds refreshes.
  const refreshDetail = useCallback(async (id: BlockId) => {
    const result = await adminFetch(`/api/admin/content/${id}`) as { block: BlockView };
    setBlocks((current) => current && current.map((item) => item.id === id ? { ...item, ...result.block } : item));
  }, [adminFetch]);

  const load = useCallback(async () => {
    try {
      const result = await adminFetch("/api/admin/content") as { blocks: BlockView[] };
      setBlocks(result.blocks);
      const first = result.blocks[0]?.id ?? null;
      setSelectedId((current) => current ?? first);
      setLoadError("");
      if (first) await refreshDetail(first).catch(() => { /* Earlier versions simply stay hidden. */ });
    } catch (error) {
      setLoadError(errorText(error, "Unable to load site content"));
    }
  }, [adminFetch, refreshDetail]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    adminFetch("/api/admin/products").then((result) => {
      const list = (result as { products: { slug: string; name: string; status: string }[] }).products;
      setProducts(list.map(({ slug, name, status }) => ({ slug, name, status })));
    }).catch(() => { /* The featured-pieces picker simply stays empty. */ });
  }, [adminFetch]);

  const block = blocks?.find((item) => item.id === selectedId) ?? null;
  const values = block ? edits[block.id] ?? block.values : null;
  const dirty = !!block && !!edits[block.id] && !sameValues(block.fields, edits[block.id]!, block.values);
  const anyDirty = !!blocks && blocks.some((item) => edits[item.id] && !sameValues(item.fields, edits[item.id]!, item.values));
  const problems = block && values ? describeProblems(block.fields, values) : [];
  const hasServerDraft = block?.status === "draft" || block?.status === "changed";
  const canPublish = !!block && !busy && problems.length === 0 && (dirty || hasServerDraft);

  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  function applyBlock(next: Partial<BlockView> & { id: BlockId }) {
    setBlocks((current) => current && current.map((item) => item.id === next.id ? { ...item, ...next } : item));
    setEdits((current) => { const copy = { ...current }; delete copy[next.id]; return copy; });
  }

  async function select(id: BlockId) {
    setSelectedId(id); setConfirm(null); setNotice(null); setConflict(false);
    try {
      await refreshDetail(id);
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error, "Unable to load this section") });
    }
  }

  function setField(key: string, value: FieldValue) {
    if (!block || !values) return;
    setEdits((current) => ({ ...current, [block.id]: { ...values, [key]: value } }));
    setNotice(null);
  }

  async function run<T>(work: () => Promise<T>, fallback: string): Promise<T | null> {
    setBusy(true); setNotice(null); setConflict(false);
    try {
      return await work();
    } catch (error) {
      const text = errorText(error, fallback);
      setNotice({ kind: "error", text });
      setConflict(/someone else changed|reload this section/i.test(text));
      return null;
    } finally {
      setBusy(false); setConfirm(null);
    }
  }

  async function saveDraftRequest(target: BlockView, toSave: ContentValues): Promise<BlockView> {
    const result = await adminFetch(`/api/admin/content/${target.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: toSave, version: target.version }),
    }) as { block: BlockView };
    return { ...target, ...result.block };
  }

  async function saveDraft() {
    if (!block || !values) return;
    const saved = await run(() => saveDraftRequest(block, values), "Unable to save the draft");
    if (saved) {
      applyBlock(saved);
      setNotice({ kind: "ok", text: "Draft saved. The live site has not changed." });
    }
  }

  async function publish() {
    if (!block || !values) return;
    const published = await run(async () => {
      const current = dirty ? await saveDraftRequest(block, values) : block;
      const result = await adminFetch(`/api/admin/content/${block.id}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: current.version }),
      }) as { block: BlockView };
      return { ...current, ...result.block };
    }, "Unable to publish");
    if (published) {
      applyBlock(published);
      setNotice({ kind: "ok", text: "Published. The live site now shows this text." });
    }
  }

  async function discard() {
    if (!block) return;
    if (!hasServerDraft) {
      applyBlock({ id: block.id });
      setConfirm(null);
      setNotice({ kind: "ok", text: "Your unsaved edits were discarded." });
      return;
    }
    const discarded = await run(async () => {
      const result = await adminFetch(`/api/admin/content/${block.id}/discard`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: block.version }),
      }) as { block: BlockView };
      return { ...block, ...result.block };
    }, "Unable to discard the changes");
    if (discarded) {
      applyBlock(discarded);
      setNotice({ kind: "ok", text: "Changes discarded. The live text is unchanged." });
    }
  }

  async function restore(revision: RevisionView) {
    if (!block) return;
    if (dirty) { setNotice({ kind: "error", text: "Save or discard your edits before loading an earlier version." }); return; }
    const restored = await run(async () => {
      const result = await adminFetch(`/api/admin/content/${block.id}/restore`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId: revision.id, version: block.version }),
      }) as { block: BlockView };
      return { ...block, ...result.block };
    }, "Unable to load that version");
    if (restored) {
      applyBlock(restored);
      setNotice({ kind: "ok", text: `Version ${revision.version} loaded as a draft. Publish it to make it live.` });
    }
  }

  async function reloadSection() {
    if (!block) return;
    setBusy(true);
    try {
      const result = await adminFetch(`/api/admin/content/${block.id}`) as { block: BlockView };
      applyBlock({ ...result.block });
      setConflict(false);
      setNotice({ kind: "ok", text: "Reloaded with the latest saved version." });
    } catch (error) {
      setNotice({ kind: "error", text: errorText(error, "Unable to reload this section") });
    } finally { setBusy(false); }
  }

  async function uploadPhoto(key: string, file: File) {
    if (!values) return;
    if (file.size === 0 || file.size > maxUploadBytes || !uploadMimeTypes.includes(file.type)) {
      setNotice({ kind: "error", text: `${file.name} must be a JPEG, PNG, WebP or AVIF under 8 MB.` });
      return;
    }
    const data = new FormData(); data.append("file", file);
    const result = await run(() => adminFetch("/api/admin/upload", { method: "POST", body: data }) as Promise<{ url: string }>, "Upload failed");
    if (result) {
      // The old description belongs to the old photograph, so it is cleared: a
      // stale description would be read aloud to people using screen readers.
      setField(key, { url: result.url, alt: "" });
      setNotice({ kind: "ok", text: "Photograph uploaded. Describe what it shows, then save the draft." });
    }
  }

  function renderField(field: FieldSpec) {
    if (!values) return null;
    const value = values[field.key];
    const counter = field.max && (field.kind === "text" || field.kind === "paragraph")
      ? <small className={styles.fieldCount}>{String(value).length}/{field.max}</small> : null;
    const label = <>{field.label}{field.required && <abbr title="Required" aria-label="required"> *</abbr>}</>;
    const help = field.help ? <span className={styles.fieldHelp}>{field.help}</span> : null;
    switch (field.kind) {
      case "text":
      case "link":
      case "email":
      case "phone":
      case "handle":
        return <label key={field.key}><span>{label}</span>
          <input value={value as string} maxLength={field.max} disabled={busy}
            type={field.kind === "email" ? "email" : field.kind === "phone" ? "tel" : "text"}
            inputMode={field.kind === "phone" ? "tel" : undefined}
            onChange={(event) => setField(field.key, event.target.value)} />
          <span className={styles.fieldMeta}>{help}{counter}</span></label>;
      case "paragraph":
        return <label key={field.key}><span>{label}</span>
          <textarea value={value as string} maxLength={field.max} disabled={busy} rows={(field.max ?? 0) > 1000 ? 12 : 4}
            onChange={(event) => setField(field.key, event.target.value)} />
          <span className={styles.fieldMeta}>{help}{counter}</span></label>;
      case "toggle":
        return <label key={field.key} className={styles.checkbox}>
          <input type="checkbox" checked={value as boolean} disabled={busy} onChange={(event) => setField(field.key, event.target.checked)} />
          <span>{field.label}</span></label>;
      case "image": {
        const image = value as ImageValue;
        const siteChoice = approvedEditorialImages.includes(image.url) ? image.url : "";
        return <div key={field.key} className={styles.imageField} role="group" aria-label={field.label}>
          <Image src={image.url} alt="" width={120} height={160} unoptimized />
          <div className={styles.imageTools}>
            <strong>{label}</strong>
            <label><span>Description (read aloud to people using screen readers) <abbr title="Required" aria-label="required">*</abbr></span>
              <input value={image.alt} maxLength={200} disabled={busy} onChange={(event) => setField(field.key, { ...image, alt: event.target.value })} />
              <span className={styles.fieldMeta}><small className={styles.fieldCount}>{image.alt.length}/200</small></span></label>
            <div className={styles.imageButtons}>
              <button type="button" className={styles.uploadButton} disabled={busy}
                onClick={() => { uploadingFor.current = field.key; fileInput.current?.click(); }}>Upload a photograph</button>
              <select aria-label={`Choose a site photograph for ${field.label}`} value={siteChoice} disabled={busy}
                onChange={(event) => { if (event.target.value) setField(field.key, { url: event.target.value, alt: image.alt.trim() ? image.alt : siteImageLabels[event.target.value] ?? "" }); }}>
                <option value="">Or choose a site photograph…</option>
                {approvedEditorialImages.map((url) => <option key={url} value={url}>{siteImageLabels[url] ?? url}</option>)}
              </select>
            </div>
            <span className={styles.fieldHelp}>{field.help ? `${field.help} ` : ""}JPEG, PNG, WebP or AVIF under 8 MB. Use a web-sized image, ideally under 1 MB, so pages stay fast.</span>
          </div>
        </div>;
      }
      case "products": {
        const chosen = value as string[];
        const max = field.max ?? 2;
        const toggle = (slug: string) => {
          if (chosen.includes(slug)) setField(field.key, chosen.filter((item) => item !== slug));
          else if (chosen.length < max) setField(field.key, [...chosen, slug]);
        };
        const known = new Set(products.map((product) => product.slug));
        return <div key={field.key} className={styles.chipField} role="group" aria-label={field.label}>
          <strong>{label}</strong>
          <div className={styles.chips}>
            {products.map((product) => <button type="button" key={product.slug} aria-pressed={chosen.includes(product.slug)} disabled={busy || (!chosen.includes(product.slug) && chosen.length >= max)}
              onClick={() => toggle(product.slug)}>{product.name}{product.status !== "published" ? ` (${product.status})` : ""}</button>)}
            {chosen.filter((slug) => !known.has(slug)).map((slug) => <button type="button" key={slug} aria-pressed="true" disabled={busy} onClick={() => toggle(slug)}>{slug}</button>)}
            {products.length === 0 && chosen.length === 0 && <span className={styles.fieldHelp}>No products yet.</span>}
          </div>
          <span className={styles.fieldHelp}>{field.help ? `${field.help} ` : ""}Choose up to {max}. Pieces that are not available yet show their supplied preview photograph.</span>
        </div>;
      }
    }
  }

  if (loadError) return <div className={styles.layout}><section className={styles.editor}><p role="alert" className={styles.message}>{loadError}</p><div className={styles.actions}><button type="button" onClick={() => void load()}>Try again</button></div></section></div>;
  if (!blocks) return <div className={styles.layout}><section className={styles.editor}><p role="status" className={styles.message}>Loading site content…</p></section></div>;

  return <div className={styles.layout}>
    <aside className={styles.sidebar}>
      <p className={styles.eyebrow}>SITE CONTENT</p>
      <h2>Sections <span>{blocks.length}</span></h2>
      <div className={styles.productList}>{blocks.map((item) => {
        const unsaved = !!edits[item.id] && !sameValues(item.fields, edits[item.id]!, item.values);
        return <button type="button" key={item.id} className={item.id === selectedId ? styles.selected : ""} onClick={() => void select(item.id)}>
          <strong>{item.label}{unsaved ? " •" : ""}</strong>
          <small>{unsaved ? "Unsaved edits" : statusLabel[item.status]}</small>
        </button>;
      })}</div>
      <p className={styles.sideNote}>Text is plain: no formatting or links inside paragraphs. Saving a draft never changes the website. Only Publish does.</p>
    </aside>
    <section className={styles.editor}>
      <input ref={fileInput} type="file" accept={uploadMimeTypes.join(",")} hidden
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file && uploadingFor.current) void uploadPhoto(uploadingFor.current, file); }} />
      {block && values && <>
        <div className={styles.editorTop}>
          <div><p className={styles.eyebrow}>SECTION</p><h1>{block.label}</h1></div>
          <span className={styles.status}>{dirty ? "Unsaved edits" : statusLabel[block.status]}</span>
        </div>
        <p className={styles.hint}>{block.description}</p>
        {notice && <p role={notice.kind === "error" ? "alert" : "status"} className={styles.message}>{notice.text}</p>}
        {conflict && <div className={styles.actions}><button type="button" className={styles.archive} disabled={busy} onClick={() => void reloadSection()}>Reload this section (drops your unsaved edits)</button></div>}
        <form className={styles.contentForm} onSubmit={(event) => { event.preventDefault(); void saveDraft(); }} noValidate>
          {block.fields.map(renderField)}
          {problems.length > 0 && <ul className={styles.problems} aria-label="Fix before saving">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
          {confirm === "publish" && <div className={styles.confirmBox} role="alertdialog" aria-label="Confirm publish">
            <p>This changes the live website straight away, for everyone.</p>
            <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish now"}</button><button type="button" className={styles.archive} disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div>
          </div>}
          {confirm === "discard" && <div className={styles.confirmBox} role="alertdialog" aria-label="Confirm discard">
            <p>{hasServerDraft ? "Your saved draft and unsaved edits will be thrown away. The live text stays as it is." : "Your unsaved edits will be thrown away."}</p>
            <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void discard()}>Discard</button><button type="button" className={styles.archive} disabled={busy} onClick={() => setConfirm(null)}>Keep editing</button></div>
          </div>}
          {!confirm && <div className={styles.actions}>
            <button type="submit" disabled={busy || !dirty || problems.length > 0}>{busy ? "Working…" : "Save draft"}</button>
            <button type="button" disabled={!canPublish} onClick={() => setConfirm("publish")}>Publish</button>
            <button type="button" className={styles.archive} disabled={busy || (!dirty && !hasServerDraft)} onClick={() => setConfirm("discard")}>Discard changes</button>
          </div>}
        </form>
        <p className={styles.hint}>
          {block.publishedAt ? `Last published ${new Date(block.publishedAt).toLocaleString("en-GH")}. ` : "Not published yet, so the website uses the built-in text. "}
          <a href={livePage[block.id]} target="_blank" rel="noreferrer">View the live page</a>
        </p>
        {block.revisions && block.revisions.length > 0 && <div className={styles.revisions}>
          <h2>Earlier versions</h2>
          <p className={styles.hint}>Loading a version puts it in the draft. It goes live only when you publish.</p>
          <ol>{block.revisions.map((revision) => <li key={revision.id}>
            <span>Version {revision.version} · {new Date(revision.publishedAt).toLocaleString("en-GH")}<small> · by {revision.publishedBy.slice(0, 6)}</small></span>
            <button type="button" className={styles.archive} disabled={busy} onClick={() => void restore(revision)}>Load into draft</button>
          </li>)}</ol>
        </div>}
      </>}
    </section>
  </div>;
}
