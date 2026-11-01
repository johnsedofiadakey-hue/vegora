// Editable site content: block definitions, validation, and the draft/publish
// lifecycle. Everything here is plain TypeScript with no server imports so the
// rules can be unit tested and reused by the admin form and the storefront.
//
// Content is plain text only. Nothing in a block is ever treated as HTML, and
// links and images are restricted to the site's own pages and approved media.

export type FieldKind = "text" | "paragraph" | "link" | "image" | "toggle" | "email" | "phone" | "handle";

export interface ImageValue { url: string; alt: string }

export interface FieldValueByKind {
  text: string;
  paragraph: string;
  link: string;
  image: ImageValue;
  toggle: boolean;
  email: string;
  phone: string;
  handle: string;
}

export type FieldValue = FieldValueByKind[FieldKind];

export type Field = {
  [K in FieldKind]: {
    kind: K;
    label: string;
    help?: string;
    /** Maximum characters. */
    max?: number;
    required?: boolean;
    default: FieldValueByKind[K];
  };
}[FieldKind];

type BlockSpec<F extends Record<string, Field>> = {
  label: string;
  description: string;
  fields: F;
  /** Cross-field rule checked after every field passes. Return a message to reject. */
  check?: (values: BlockValues<F>) => string | null;
};

export type BlockValues<F extends Record<string, Field>> = {
  [K in keyof F]: FieldValueByKind[F[K]["kind"]];
};

function defineBlock<F extends Record<string, Field>>(spec: BlockSpec<F>): BlockSpec<F> {
  return spec;
}

/** Photograph uploads accepted by the admin, matching /api/admin/upload. */
export const maxUploadBytes = 8 * 1024 * 1024;
export const uploadMimeTypes: readonly string[] = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const approvedEditorialImages: readonly string[] = [
  "/editorial/ve-man.png",
  "/editorial/ve-man-coat.png",
  "/editorial/ve-woman.png",
  "/editorial/ve-woman-light.png",
  "/editorial/ve-detail.png",
];

export const blocks = {
  announcement: defineBlock({
    label: "Announcement bar",
    description: "A single line shown above the header on every page. Leave it switched off when there is nothing to announce.",
    fields: {
      enabled: { kind: "toggle", label: "Show the bar", default: false },
      text: { kind: "text", label: "Message", max: 120, default: "", help: "One short line. Required while the bar is on." },
      link: { kind: "link", label: "Link (optional)", max: 200, default: "", help: "A page on this site, such as /new-in, or a full https:// address." },
    },
    check: (values) => values.enabled && !values.text ? "Add a message before switching the announcement bar on" : null,
  }),
  home: defineBlock({
    label: "Homepage",
    description: "The opening screen, the introduction, and the heading above the new arrivals. The pieces themselves come from the catalogue: every published piece tagged New arrival appears there.",
    fields: {
      heroEyebrow: { kind: "text", label: "Hero small heading", max: 60, required: true, default: "VEGORA / A NEW PERSPECTIVE" },
      heroLine1: { kind: "text", label: "Hero headline, first line", max: 40, required: true, default: "The art" },
      heroLine2: { kind: "text", label: "Hero headline, second line", max: 40, required: true, default: "of dressing" },
      heroSubline: { kind: "text", label: "Hero tagline", max: 120, required: true, default: "Style is personal. Make it yours." },
      heroImage: { kind: "image", label: "Hero photograph", required: true, help: "Portrait photograph. It is cropped to a tall frame, so keep the subject centred.", default: { url: "/editorial/ve-man.png", alt: "VEGORA editorial portrait of a man in black tailoring" } },
      introLabel: { kind: "text", label: "Introduction small heading", max: 60, required: true, default: "AN EXPRESSION OF YOU" },
      introLead: { kind: "text", label: "Introduction headline", max: 60, required: true, default: "Considered style." },
      introEmphasis: { kind: "text", label: "Introduction headline, italic line", max: 60, required: true, default: "Distinct presence." },
      introBody: { kind: "text", label: "Introduction text", max: 200, required: true, default: "VEGORA explores the way we dress and the presence we bring to every room." },
      arrivalsLabel: { kind: "text", label: "New arrivals small heading", max: 60, required: true, default: "VEGORA / NEW IN" },
      arrivalsLead: { kind: "text", label: "New arrivals headline", max: 60, required: true, default: "The latest" },
      arrivalsEmphasis: { kind: "text", label: "New arrivals headline, italic line", max: 60, required: true, default: "arrivals." },
      arrivalsBody: { kind: "paragraph", label: "New arrivals text", max: 300, required: true, default: "The latest pieces from VEGORA. Open a piece to choose your size and add it to your bag." },
      arrivalsLinkLabel: { kind: "text", label: "New arrivals link text", max: 40, required: true, default: "View all new in" },
    },
  }),
  edit: defineBlock({
    label: "The Edit page",
    description: "The editorial page: lead text, photograph and closing paragraph.",
    fields: {
      pageLabel: { kind: "text", label: "Small heading", max: 60, required: true, default: "VEGORA / THE EDIT" },
      leadLine1: { kind: "text", label: "Headline", max: 60, required: true, default: "The art of" },
      leadEmphasis: { kind: "text", label: "Headline, italic line", max: 60, required: true, default: "dressing." },
      leadBody: { kind: "text", label: "Lead text", max: 200, required: true, default: "A visual expression of presence, individuality, and considered style." },
      image: { kind: "image", label: "Photograph", required: true, default: { url: "/editorial/ve-man-coat.png", alt: "Man in a black overcoat" } },
      copyLabel: { kind: "text", label: "Closing small heading", max: 60, required: true, default: "AN EXPRESSION OF YOU" },
      copyLead: { kind: "text", label: "Closing headline", max: 60, required: true, default: "Wear what feels" },
      copyEmphasis: { kind: "text", label: "Closing headline, italic line", max: 60, required: true, default: "like you." },
      copyBody: { kind: "paragraph", label: "Closing text", max: 400, required: true, default: "VEGORA is a space for personal style. Explore the collection as it comes to life." },
    },
  }),
  about: defineBlock({
    label: "About page",
    description: "The brand story. Separate paragraphs with a blank line.",
    fields: {
      label: { kind: "text", label: "Small heading", max: 60, required: true, default: "THE HOUSE / VEGORA" },
      headingLead: { kind: "text", label: "Headline", max: 60, required: true, default: "Style is" },
      headingEmphasis: { kind: "text", label: "Headline, italic line", max: 60, required: true, default: "personal." },
      body: { kind: "paragraph", label: "Story", max: 3000, required: true, default: "VEGORA is a new destination for considered fashion. Our visual world is built on contrast, clarity, and the confidence of individual expression.\n\nAs the collection takes shape, this space will introduce the pieces, people, and ideas behind the brand." },
      linkLabel: { kind: "text", label: "Link text", max: 40, required: true, default: "Discover the edit" },
    },
  }),
  contact: defineBlock({
    label: "Contact and footer",
    description: "How customers reach VEGORA, and the line under the footer logo. The contact page appears once at least one channel is filled in.",
    fields: {
      intro: { kind: "paragraph", label: "Contact page introduction", max: 600, default: "", help: "Optional. A sentence or two above the contact details." },
      email: { kind: "email", label: "Email", max: 254, default: "" },
      phone: { kind: "phone", label: "Phone", max: 20, default: "" },
      whatsapp: { kind: "phone", label: "WhatsApp number", max: 20, default: "", help: "Include the country code, for example +233…" },
      instagram: { kind: "handle", label: "Instagram handle", max: 30, default: "", help: "Without the @." },
      hours: { kind: "text", label: "Support hours", max: 120, default: "" },
      footerTagline: { kind: "text", label: "Footer tagline", max: 100, required: true, default: "A considered point of view on dressing." },
    },
  }),
  delivery: defineBlock({
    label: "Delivery information",
    description: "The delivery page. It stays hidden until you publish text. Use the wording the owner has approved.",
    fields: {
      title: { kind: "text", label: "Page title", max: 80, required: true, default: "Delivery" },
      body: { kind: "paragraph", label: "Text", max: 8000, default: "", help: "Separate paragraphs with a blank line." },
    },
  }),
  returns: defineBlock({
    label: "Returns and exchanges",
    description: "The returns page. It stays hidden until you publish text. Use the wording the owner has approved.",
    fields: {
      title: { kind: "text", label: "Page title", max: 80, required: true, default: "Returns & exchanges" },
      body: { kind: "paragraph", label: "Text", max: 8000, default: "", help: "Separate paragraphs with a blank line." },
    },
  }),
  privacy: defineBlock({
    label: "Privacy policy",
    description: "How customer details are used. It stays hidden until you publish text. Use wording the owner or their adviser has approved.",
    fields: {
      title: { kind: "text", label: "Page title", max: 80, required: true, default: "Privacy policy" },
      body: { kind: "paragraph", label: "Text", max: 12000, default: "", help: "Separate paragraphs with a blank line." },
    },
  }),
  terms: defineBlock({
    label: "Terms of sale",
    description: "The terms customers accept when they order. It stays hidden until you publish text. Use wording the owner or their adviser has approved.",
    fields: {
      title: { kind: "text", label: "Page title", max: 80, required: true, default: "Terms of sale" },
      body: { kind: "paragraph", label: "Text", max: 12000, default: "", help: "Separate paragraphs with a blank line." },
    },
  }),
};

export type BlockId = keyof typeof blocks;
export const blockIds = Object.keys(blocks) as BlockId[];
export type ContentValues = Record<string, FieldValue>;
export type TypedValues<K extends BlockId> = BlockValues<(typeof blocks)[K]["fields"]>;

export function isBlockId(value: string): value is BlockId {
  return Object.prototype.hasOwnProperty.call(blocks, value);
}

function fieldsOf(id: BlockId): Record<string, Field> {
  return blocks[id].fields as Record<string, Field>;
}

/** Why a request was refused. The server maps these to HTTP statuses. */
export type SiteContentErrorKind = "invalid" | "conflict" | "not_found" | "nothing_to_publish";

export class SiteContentError extends Error {
  kind: SiteContentErrorKind;

  constructor(message: string, kind: SiteContentErrorKind = "invalid") {
    super(message);
    this.name = "SiteContentError";
    this.kind = kind;
  }
}

// ---------------------------------------------------------------- validation

const controlCharacters = /[\u0000-\u001F\u007F]/;
const paragraphControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const bidiControls = /[‪-‮⁦-⁩]/;
const markup = /<\/?[A-Za-z!][^>]*>/;
const internalLink = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,2})?$/;
const mediaPath = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp|avif)$/i;
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const phonePattern = /^\+?[0-9][0-9 ()-]{5,19}$/;
const handlePattern = /^[A-Za-z0-9._]{1,30}$/;

function invalid(field: Field, message: string): never {
  throw new SiteContentError(`${field.label}: ${message}`);
}

function plainText(field: Field, value: unknown, multiline: boolean): string {
  if (typeof value !== "string") invalid(field, "must be text");
  const clean = (multiline ? value.replace(/\r\n?/g, "\n") : value).trim();
  const max = field.max ?? 200;
  if (clean.length > max) invalid(field, `must be ${max} characters or fewer`);
  if (field.required && !clean) invalid(field, "is required");
  if ((multiline ? paragraphControlCharacters : controlCharacters).test(clean)) invalid(field, "contains characters that are not allowed");
  if (bidiControls.test(clean)) invalid(field, "contains characters that are not allowed");
  if (markup.test(clean)) invalid(field, "must be plain text, without HTML tags");
  return multiline ? clean.replace(/\n{3,}/g, "\n\n") : clean;
}

function linkValue(field: Field, value: unknown): string {
  const clean = plainText(field, value, false);
  if (!clean) return clean;
  if (internalLink.test(clean)) return clean;
  let url: URL;
  try { url = new URL(clean); } catch { return invalid(field, "must be a page on this site, like /new-in, or a full https:// address"); }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) {
    invalid(field, "must be a page on this site, like /new-in, or a full https:// address");
  }
  return clean;
}

function imageValue(field: Field, value: unknown): ImageValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(field, "must include a photograph and its description");
  const image = value as Record<string, unknown>;
  if (typeof image.url !== "string" || typeof image.alt !== "string") invalid(field, "must include a photograph and its description");
  const url = image.url.trim();
  if (!mediaPath.test(url) && !approvedEditorialImages.includes(url)) {
    invalid(field, "upload the photograph through the admin or use one of the approved site images");
  }
  const alt = plainText({ ...field, label: `${field.label} description`, max: 200, required: true }, image.alt, false);
  return { url, alt };
}

function parseField(field: Field, value: unknown): FieldValue {
  switch (field.kind) {
    case "text": return plainText(field, value, false);
    case "paragraph": return plainText(field, value, true);
    case "link": return linkValue(field, value);
    case "image": return imageValue(field, value);
    case "toggle":
      if (typeof value !== "boolean") invalid(field, "must be on or off");
      return value;
    case "email": {
      const clean = plainText(field, value, false);
      if (clean && !emailPattern.test(clean)) invalid(field, "is not a valid email address");
      return clean;
    }
    case "phone": {
      const clean = plainText(field, value, false);
      if (clean && !phonePattern.test(clean)) invalid(field, "is not a valid phone number");
      return clean;
    }
    case "handle": {
      const clean = plainText(field, value, false).replace(/^@/, "");
      if (clean && !handlePattern.test(clean)) invalid(field, "may use letters, numbers, dots and underscores only");
      return clean;
    }
  }
}

function cloneValue<T extends FieldValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function defaultValues(id: BlockId): ContentValues {
  const values: ContentValues = {};
  for (const [key, field] of Object.entries(fieldsOf(id))) values[key] = cloneValue(field.default);
  return values;
}

/**
 * Validates a full or partial set of values for one block. Keys that are not
 * sent keep their value from `base`. Unknown keys are rejected so typos surface
 * instead of being silently dropped.
 */
export function parseValues(id: BlockId, input: unknown, base: ContentValues = defaultValues(id)): ContentValues {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SiteContentError("Content must be an object");
  }
  const fields = fieldsOf(id);
  const sent = input as Record<string, unknown>;
  for (const key of Object.keys(sent)) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) throw new SiteContentError(`Unknown field “${key}”`);
  }
  const values: ContentValues = {};
  for (const [key, field] of Object.entries(fields)) {
    values[key] = Object.prototype.hasOwnProperty.call(sent, key)
      ? parseField(field, sent[key])
      : parseField(field, base[key] ?? field.default);
  }
  const problem = (blocks[id].check as ((values: ContentValues) => string | null) | undefined)?.(values);
  if (problem) throw new SiteContentError(problem);
  return values;
}

/**
 * Reads stored content for display. A field that is missing or no longer valid
 * falls back to its default, so bad stored data can never break a page.
 */
export function resolveValues(id: BlockId, stored: unknown): ContentValues {
  const values = defaultValues(id);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return values;
  const source = stored as Record<string, unknown>;
  for (const [key, field] of Object.entries(fieldsOf(id))) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    try { values[key] = parseField(field, source[key]); } catch { /* keep the default */ }
  }
  const problem = (blocks[id].check as ((values: ContentValues) => string | null) | undefined)?.(values);
  return problem ? defaultValues(id) : values;
}

export function sameValues(id: BlockId, a: ContentValues, b: ContentValues): boolean {
  return Object.keys(fieldsOf(id)).every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
}

// ----------------------------------------------------------------- lifecycle

export interface BlockState {
  version: number;
  draft: ContentValues | null;
  published: ContentValues | null;
  draftUpdatedAt: string | null;
  draftUpdatedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface Revision {
  values: ContentValues;
  /** Version of the block when this revision was published. */
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export type BlockStatus = "default" | "published" | "draft" | "changed";

export const emptyBlockState: BlockState = {
  version: 0, draft: null, published: null,
  draftUpdatedAt: null, draftUpdatedBy: null, publishedAt: null, publishedBy: null,
};

export function normalizeState(raw: unknown): BlockState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...emptyBlockState };
  const value = raw as Partial<BlockState>;
  const text = (item: unknown) => typeof item === "string" ? item : null;
  const values = (item: unknown) => item && typeof item === "object" && !Array.isArray(item) ? item as ContentValues : null;
  return {
    version: Number.isSafeInteger(value.version) ? Number(value.version) : 0,
    draft: values(value.draft), published: values(value.published),
    draftUpdatedAt: text(value.draftUpdatedAt), draftUpdatedBy: text(value.draftUpdatedBy),
    publishedAt: text(value.publishedAt), publishedBy: text(value.publishedBy),
  };
}

/** What the storefront shows: the published copy, or the built-in defaults. */
export function publishedValues(id: BlockId, state: BlockState): ContentValues {
  return resolveValues(id, state.published);
}

/** What the admin form starts from: unpublished changes, else what is live. */
export function editorValues(id: BlockId, state: BlockState): ContentValues {
  return state.draft ? resolveValues(id, state.draft) : publishedValues(id, state);
}

export function blockStatus(id: BlockId, state: BlockState): BlockStatus {
  if (!state.published) return state.draft ? "draft" : "default";
  if (!state.draft) return "published";
  return sameValues(id, resolveValues(id, state.draft), publishedValues(id, state)) ? "published" : "changed";
}

function requireVersion(state: BlockState, expectedVersion: unknown): void {
  if (!Number.isSafeInteger(expectedVersion)) throw new SiteContentError("Reload this section and try again", "conflict");
  if (expectedVersion !== state.version) {
    throw new SiteContentError("Someone else changed this section. Reload it to see their changes before saving", "conflict");
  }
}

export function saveDraft(id: BlockId, state: BlockState, input: unknown, expectedVersion: unknown, actorUid: string, now: string): BlockState {
  requireVersion(state, expectedVersion);
  const draft = parseValues(id, input, editorValues(id, state));
  return { ...state, version: state.version + 1, draft, draftUpdatedAt: now, draftUpdatedBy: actorUid };
}

export function publishDraft(id: BlockId, state: BlockState, expectedVersion: unknown, actorUid: string, now: string): { state: BlockState; revision: Revision } {
  requireVersion(state, expectedVersion);
  if (!state.draft) throw new SiteContentError("There are no changes to publish", "nothing_to_publish");
  const draft = resolveValues(id, state.draft);
  if (state.published && sameValues(id, draft, publishedValues(id, state))) {
    throw new SiteContentError("There are no changes to publish", "nothing_to_publish");
  }
  const version = state.version + 1;
  return {
    state: { ...state, version, draft, published: draft, publishedAt: now, publishedBy: actorUid },
    revision: { values: draft, version, publishedAt: now, publishedBy: actorUid },
  };
}

/** Throws away unpublished changes. What is live stays as it is. */
export function discardDraft(state: BlockState, expectedVersion: unknown): BlockState {
  requireVersion(state, expectedVersion);
  if (!state.draft) throw new SiteContentError("There are no changes to discard", "nothing_to_publish");
  return { ...state, version: state.version + 1, draft: null, draftUpdatedAt: null, draftUpdatedBy: null };
}

/** Loads an older published version into the draft. It goes live only when published. */
export function restoreRevision(id: BlockId, state: BlockState, revision: Revision | null, expectedVersion: unknown, actorUid: string, now: string): BlockState {
  requireVersion(state, expectedVersion);
  if (!revision) throw new SiteContentError("That version no longer exists", "not_found");
  return { ...state, version: state.version + 1, draft: resolveValues(id, revision.values), draftUpdatedAt: now, draftUpdatedBy: actorUid };
}

// ------------------------------------------------------------- page helpers

export function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
}

export function contactChannels(values: ContentValues): { kind: "email" | "phone" | "whatsapp" | "instagram"; value: string }[] {
  const result: { kind: "email" | "phone" | "whatsapp" | "instagram"; value: string }[] = [];
  for (const kind of ["email", "phone", "whatsapp", "instagram"] as const) {
    const value = values[kind];
    if (typeof value === "string" && value) result.push({ kind, value });
  }
  return result;
}

/** Link for a contact channel. Values were validated when saved, so they are safe to put in a link. */
export function contactHref(kind: "email" | "phone" | "whatsapp" | "instagram", value: string): string {
  switch (kind) {
    case "email": return `mailto:${value}`;
    case "phone": return `tel:${value.replace(/[^+0-9]/g, "")}`;
    case "whatsapp": return `https://wa.me/${value.replace(/\D/g, "")}`;
    case "instagram": return `https://instagram.com/${value}`;
  }
}

/** The delivery and returns pages stay hidden until they have text. */
export function policyIsLive(values: ContentValues): boolean {
  return typeof values.body === "string" && values.body.trim().length > 0;
}

/** A JSON-friendly description of every block, used by the admin form. */
export function describeBlocks() {
  return blockIds.map((id) => ({
    id,
    label: blocks[id].label,
    description: blocks[id].description,
    fields: Object.entries(fieldsOf(id)).map(([key, field]) => ({ key, ...field })),
  }));
}
