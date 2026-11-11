import test from "node:test";
import assert from "node:assert/strict";
import {
  blockIds, blocks, blockStatus, contactChannels, contactDisplay, contactHref, defaultValues, describeBlocks, discardDraft, editorValues,
  emptyBlockState, isBlockId, normalizeState, paragraphs, parseValues, policyIsLive, publishDraft,
  publishedValues, resolveValues, restoreRevision, saveDraft, SiteContentError, socialLinks, whatsappNumber,
} from "../src/lib/site-content.ts";

const t0 = "2026-10-31T10:00:00.000Z";
const t1 = "2026-10-31T11:00:00.000Z";
const t2 = "2026-10-31T12:00:00.000Z";

const rejects = (fn, kind = "invalid") => assert.throws(fn, (error) => error instanceof SiteContentError && error.kind === kind, String(fn));

test("every block's built-in defaults pass its own validation", () => {
  assert.deepEqual(blockIds, ["announcement", "home", "edit", "about", "contact", "delivery", "returns", "privacy", "terms"]);
  for (const id of blockIds) {
    const defaults = defaultValues(id);
    assert.deepEqual(parseValues(id, defaults), defaults, id);
    assert.deepEqual(resolveValues(id, defaults), defaults, id);
    assert.equal(blockStatus(id, emptyBlockState), "default", id);
  }
});

test("defaults are copies, so editing one never changes the built-in text", () => {
  const a = defaultValues("home");
  a.heroLine1 = "Changed";
  a.heroImage.alt = "Changed";
  a.heroImage.url = "/changed.png";
  const b = defaultValues("home");
  assert.equal(b.heroLine1, "Dress well.");
  assert.notEqual(b.heroImage.alt, "Changed");
  assert.equal(b.heroImage.url, "/editorial/ve-navy-model-v1.webp");
});

test("the homepage defaults use short, plain wording", () => {
  const home = defaultValues("home");
  assert.equal(home.heroLine1, "Dress well.");
  assert.equal(home.heroLine2, "Be yourself.");
  assert.equal(home.introLead, "Simple clothes.");
  assert.equal(home.arrivalsLead, "Our newest");
  assert.equal(home.arrivalsEmphasis, "clothes.");
  assert.equal(home.arrivalsLinkLabel, "See all new clothes");
  assert.equal(defaultValues("about").body.split("\n\n").length, 3);
});

test("text is plain: no markup, no control characters, length limits enforced", () => {
  const home = (patch) => parseValues("home", patch);
  assert.equal(home({ heroLine1: "  Spacing  " }).heroLine1, "Spacing");
  rejects(() => home({ heroLine1: "<b>Bold</b>" }));
  rejects(() => home({ heroLine1: "<script>alert(1)</script>" }));
  rejects(() => home({ heroLine1: "<!-- comment -->" }));
  rejects(() => home({ heroLine1: "Line\nbreak" }));
  rejects(() => home({ heroLine1: "bad\u0000char" }));
  rejects(() => home({ heroLine1: "‮evil" }));
  rejects(() => home({ heroLine1: "x".repeat(41) }));
  rejects(() => home({ heroLine1: "" }));
  rejects(() => home({ heroLine1: 5 }));
  assert.equal(home({ heroLine1: "5 < 6 and 7 > 3" }).heroLine1, "5 < 6 and 7 > 3");
});

test("paragraphs keep blank lines, tidy line endings and reject markup", () => {
  const about = parseValues("about", { body: "One.\r\n\r\n\r\n\r\nTwo." });
  assert.equal(about.body, "One.\n\nTwo.");
  assert.deepEqual(paragraphs(about.body), ["One.", "Two."]);
  rejects(() => parseValues("about", { body: "Hello <img src=x onerror=alert(1)>" }));
  rejects(() => parseValues("about", { body: "x".repeat(3001) }));
  rejects(() => parseValues("about", { body: "" }));
  assert.equal(parseValues("delivery", { body: "" }).body, "");
});

test("links must be pages on this site or https addresses", () => {
  const bar = (link) => parseValues("announcement", { enabled: true, text: "Hello", link });
  for (const ok of ["", "/", "/new-in", "/men", "/product/red-stripe-tee", "https://example.com/offer", "https://shop.example.co.gh"]) {
    assert.equal(bar(ok).link, ok);
  }
  for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,hi", "http://example.com", "//evil.com", "/../x",
    "/New-In", "/a/b/c/d", "https://user:pass@example.com", "https://localhost", "mailto:a@b.co", "new-in", "/x y"]) {
    rejects(() => bar(bad));
  }
});

test("images must be uploaded media or approved site photographs, with a description", () => {
  const media = "/api/media/014deacf-5394-4f2f-b393-079bc26b6f8c.png";
  const ok = parseValues("edit", { image: { url: media, alt: " A man in a coat " } });
  assert.deepEqual(ok.image, { url: media, alt: "A man in a coat" });
  assert.equal(parseValues("edit", { image: { url: "/editorial/ve-ivory-model-v1.webp", alt: "Man in ivory" } }).image.url, "/editorial/ve-ivory-model-v1.webp");
  for (const url of ["https://example.com/a.png", "/editorial/other.png", "/api/media/not-a-uuid.png", "/api/media/014deacf-5394-4f2f-b393-079bc26b6f8c.svg",
    "/catalog/red-stripe.webp", "//evil.com/a.png", "javascript:alert(1)"]) {
    rejects(() => parseValues("edit", { image: { url, alt: "Alt" } }));
  }
  rejects(() => parseValues("edit", { image: { url: media, alt: "" } }));
  rejects(() => parseValues("edit", { image: { url: media, alt: "<b>x</b>" } }));
  rejects(() => parseValues("edit", { image: { url: media } }));
  rejects(() => parseValues("edit", { image: "nope" }));
  rejects(() => parseValues("edit", { image: null }));
});

test("contact details are checked for their kind", () => {
  const good = parseValues("contact", { email: "hello@vegora.com", phone: "+233 24 123 4567", whatsapp: "+233241234567", instagram: "@vegora.gh", hours: "Mon–Sat, 9am–6pm" });
  assert.equal(good.instagram, "vegora.gh");
  assert.deepEqual(contactChannels(good).map((channel) => channel.kind), ["email", "phone", "whatsapp", "instagram"]);
  assert.deepEqual(contactChannels(defaultValues("contact")), []);
  rejects(() => parseValues("contact", { email: "not-an-email" }));
  rejects(() => parseValues("contact", { email: "a@b.co<script>" }));
  rejects(() => parseValues("contact", { phone: "call me" }));
  rejects(() => parseValues("contact", { phone: "12" }));
  rejects(() => parseValues("contact", { whatsapp: "+233-<x>" }));
  rejects(() => parseValues("contact", { instagram: "has space" }));
  rejects(() => parseValues("contact", { instagram: "https://instagram.com/vegora" }));
  rejects(() => parseValues("contact", { footerTagline: "" }));
});

test("social handles follow each network's username rules", () => {
  const good = parseValues("contact", { instagram: "vegora.gh", tiktok: "@vegora.gh", facebook: "vegora.gh", x: "@vegora_gh" });
  assert.deepEqual([good.tiktok, good.facebook, good.x], ["vegora.gh", "vegora.gh", "vegora_gh"]);
  assert.deepEqual(contactChannels(good).map((channel) => channel.kind), ["instagram", "tiktok", "facebook", "x"]);
  rejects(() => parseValues("contact", { tiktok: "a" }));
  rejects(() => parseValues("contact", { tiktok: "has space" }));
  rejects(() => parseValues("contact", { facebook: "vg" }));
  rejects(() => parseValues("contact", { facebook: "vegora_gh" }));
  rejects(() => parseValues("contact", { facebook: "https://facebook.com/vegora" }));
  rejects(() => parseValues("contact", { x: "vegora.gh" }));
  rejects(() => parseValues("contact", { x: "a_handle_that_is_too_long" }));
});

test("the announcement bar needs a message before it can be switched on", () => {
  assert.equal(parseValues("announcement", { enabled: false }).enabled, false);
  rejects(() => parseValues("announcement", { enabled: true }));
  rejects(() => parseValues("announcement", { enabled: true, text: "   " }));
  rejects(() => parseValues("announcement", { enabled: "yes", text: "Hi" }));
  assert.equal(parseValues("announcement", { enabled: true, text: "Free delivery this week" }).enabled, true);
});

test("unknown fields, wrong shapes and unknown blocks are refused", () => {
  rejects(() => parseValues("home", { heroLin1: "typo" }));
  rejects(() => parseValues("home", null));
  rejects(() => parseValues("home", []));
  rejects(() => parseValues("home", "text"));
  assert.equal(isBlockId("home"), true);
  assert.equal(isBlockId("constructor"), false);
  assert.equal(isBlockId("__proto__"), false);
  assert.equal(isBlockId("settings"), false);
});

test("stored content that is broken or out of date never breaks a page", () => {
  const stored = { heroLine1: "Kept", heroLine2: "<b>bad</b>", heroImage: { url: "https://evil.example/x.png", alt: "x" }, retired: "ignored" };
  const resolved = resolveValues("home", stored);
  assert.equal(resolved.heroLine1, "Kept");
  assert.equal(resolved.heroLine2, "Be yourself.");
  assert.deepEqual(resolved.heroImage, defaultValues("home").heroImage);
  assert.equal("retired" in resolved, false);
  for (const junk of [null, undefined, 5, "text", [], {}]) assert.deepEqual(resolveValues("home", junk), defaultValues("home"));
  // A bar stored as "on" with no message falls back to the safe default (off).
  assert.equal(resolveValues("announcement", { enabled: true, text: "" }).enabled, false);
  assert.deepEqual(normalizeState("junk"), emptyBlockState);
  assert.equal(normalizeState({ version: "7", draft: "x", published: [] }).version, 0);
});

test("published campaign paths resolve to the new product-led photographs", () => {
  const home = resolveValues("home", {
    heroImage: { url: "/editorial/ve-man.png", alt: "Man in black tailoring" },
  });
  assert.deepEqual(home.heroImage, {
    url: "/editorial/ve-navy-model-v1.webp",
    alt: "Man wearing the navy and ivory striped VEGORA T-shirt",
  });
  const edit = resolveValues("edit", {
    image: { url: "/editorial/ve-man-coat.png", alt: "Man in a black coat" },
  });
  assert.equal(edit.image.url, "/editorial/ve-ivory-model-v1.webp");
  assert.equal(edit.image.alt, "Man wearing the ivory and black striped VEGORA T-shirt");
});

test("saving a draft changes nothing that is live", () => {
  const draft = saveDraft("about", emptyBlockState, { headingLead: "Style is" , body: "New story." }, 0, "uid-1", t0);
  assert.equal(draft.version, 1);
  assert.equal(draft.published, null);
  assert.equal(draft.draftUpdatedBy, "uid-1");
  assert.equal(editorValues("about", draft).body, "New story.");
  assert.deepEqual(publishedValues("about", draft), defaultValues("about"));
  assert.equal(blockStatus("about", draft), "draft");
  // A second save keeps earlier edits and merges new ones.
  const again = saveDraft("about", draft, { label: "THE HOUSE" }, 1, "uid-1", t1);
  assert.equal(again.draft.body, "New story.");
  assert.equal(again.draft.label, "THE HOUSE");
});

test("a bad save leaves the stored state untouched", () => {
  const before = saveDraft("about", emptyBlockState, { body: "Fine." }, 0, "u", t0);
  rejects(() => saveDraft("about", before, { body: "<b>x</b>" }, 1, "u", t1));
  assert.equal(before.version, 1);
  assert.equal(before.draft.body, "Fine.");
});

test("two editors cannot silently overwrite each other", () => {
  const state = saveDraft("about", emptyBlockState, { body: "Mine." }, 0, "a", t0);
  rejects(() => saveDraft("about", state, { body: "Theirs." }, 0, "b", t1), "conflict");
  rejects(() => saveDraft("about", state, { body: "Theirs." }, undefined, "b", t1), "conflict");
  rejects(() => saveDraft("about", state, { body: "Theirs." }, "1", "b", t1), "conflict");
  rejects(() => publishDraft("about", state, 0, "b", t1), "conflict");
  rejects(() => discardDraft(state, 5), "conflict");
});

test("publishing makes the draft live, records a revision and is not repeatable", () => {
  const draft = saveDraft("about", emptyBlockState, { body: "Live story." }, 0, "editor", t0);
  const { state, revision } = publishDraft("about", draft, 1, "owner", t1);
  assert.equal(state.version, 2);
  assert.equal(publishedValues("about", state).body, "Live story.");
  assert.equal(state.publishedBy, "owner");
  assert.equal(state.publishedAt, t1);
  assert.equal(blockStatus("about", state), "published");
  assert.deepEqual(revision, { values: state.published, version: 2, publishedAt: t1, publishedBy: "owner" });
  rejects(() => publishDraft("about", state, 2, "owner", t2), "nothing_to_publish");
  rejects(() => publishDraft("about", emptyBlockState, 0, "owner", t2), "nothing_to_publish");
});

test("editing after publishing shows as changed until it is published or discarded", () => {
  let state = publishDraft("about", saveDraft("about", emptyBlockState, { body: "One." }, 0, "u", t0), 1, "u", t0).state;
  state = saveDraft("about", state, { body: "Two." }, 2, "u", t1);
  assert.equal(blockStatus("about", state), "changed");
  assert.equal(publishedValues("about", state).body, "One.");
  assert.equal(editorValues("about", state).body, "Two.");
  const discarded = discardDraft(state, 3);
  assert.equal(blockStatus("about", discarded), "published");
  assert.equal(editorValues("about", discarded).body, "One.");
  assert.equal(discarded.version, 4);
  rejects(() => discardDraft(discarded, 4), "nothing_to_publish");
  // Saving the same text again is not a change.
  const same = saveDraft("about", discarded, { body: "One." }, 4, "u", t2);
  assert.equal(blockStatus("about", same), "published");
  rejects(() => publishDraft("about", same, 5, "u", t2), "nothing_to_publish");
});

test("an earlier version can be restored into the draft without going live", () => {
  const first = publishDraft("about", saveDraft("about", emptyBlockState, { body: "First." }, 0, "u", t0), 1, "u", t0);
  const secondDraft = saveDraft("about", first.state, { body: "Second." }, 2, "u", t1);
  const second = publishDraft("about", secondDraft, 3, "u", t1);
  assert.equal(publishedValues("about", second.state).body, "Second.");
  const restored = restoreRevision("about", second.state, first.revision, 4, "owner", t2);
  assert.equal(restored.draft.body, "First.");
  assert.equal(publishedValues("about", restored).body, "Second.");
  assert.equal(blockStatus("about", restored), "changed");
  assert.equal(restored.draftUpdatedBy, "owner");
  rejects(() => restoreRevision("about", second.state, null, 4, "owner", t2), "not_found");
  rejects(() => restoreRevision("about", second.state, first.revision, 1, "owner", t2), "conflict");
  // A damaged stored revision is repaired to valid content rather than trusted.
  const damaged = restoreRevision("about", second.state, { ...first.revision, values: { body: "<b>x</b>" } }, 4, "owner", t2);
  assert.deepEqual(damaged.draft, defaultValues("about"));
});

test("delivery and returns pages stay hidden until they have text", () => {
  assert.equal(policyIsLive(defaultValues("delivery")), false);
  assert.equal(policyIsLive(defaultValues("returns")), false);
  assert.equal(policyIsLive(parseValues("delivery", { body: "   " })), false);
  assert.equal(policyIsLive(parseValues("delivery", { body: "We deliver across Accra." })), true);
});

test("the admin description lists every field with its limits", () => {
  const described = describeBlocks();
  assert.deepEqual(described.map((block) => block.id), blockIds);
  for (const block of described) {
    assert.ok(block.label && block.description, block.id);
    assert.deepEqual(block.fields.map((field) => field.key), Object.keys(blocks[block.id].fields));
    for (const field of block.fields) assert.ok(field.label, `${block.id}.${field.key}`);
  }
  // The description is sent to the browser, so it must survive JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(described)), described);
});

test("contact links are built from validated values only", () => {
  const values = parseValues("contact", { email: "hello@vegora.com", phone: "+233 (24) 123-4567", whatsapp: "+233 24 123 4567", instagram: "@vegora.gh" });
  assert.equal(contactHref("email", values.email), "mailto:hello@vegora.com");
  assert.equal(contactHref("phone", values.phone), "tel:+233241234567");
  assert.equal(contactHref("whatsapp", values.whatsapp), "https://wa.me/233241234567");
  assert.equal(contactHref("instagram", values.instagram), "https://instagram.com/vegora.gh");
  const social = parseValues("contact", { tiktok: "vegora.gh", facebook: "vegora.gh", x: "vegora_gh" });
  assert.deepEqual(socialLinks(social), [
    { platform: "tiktok", href: "https://www.tiktok.com/@vegora.gh" },
    { platform: "facebook", href: "https://www.facebook.com/vegora.gh" },
    { platform: "x", href: "https://x.com/vegora_gh" },
  ]);
  assert.deepEqual(socialLinks(values).map((link) => link.platform), ["instagram"]);
  assert.equal(contactDisplay("x", "vegora_gh"), "@vegora_gh");
  assert.equal(contactDisplay("facebook", "vegora.gh"), "vegora.gh");
  assert.equal(contactDisplay("email", "hello@vegora.com"), "hello@vegora.com");
});

test("privacy and terms stay hidden until they have text, like delivery and returns", () => {
  for (const id of ["privacy", "terms"]) {
    assert.equal(policyIsLive(defaultValues(id)), false, id);
    assert.equal(policyIsLive(parseValues(id, { body: "   " })), false, id);
    assert.equal(policyIsLive(parseValues(id, { body: "Our terms." })), true, id);
    assert.equal(parseValues(id, { body: "x".repeat(12000) }).body.length, 12000);
    rejects(() => parseValues(id, { body: "x".repeat(12001) }));
    rejects(() => parseValues(id, { body: "<script>alert(1)</script>" }));
  }
});

test("WhatsApp links use the full international number, however it was typed", () => {
  for (const typed of ["0246582579", "024 658 2579", "+233 24 658 2579", "233246582579", "00233246582579", "246582579"]) {
    assert.equal(whatsappNumber(typed), "233246582579", typed);
    assert.equal(contactHref("whatsapp", typed), "https://wa.me/233246582579", typed);
  }
});
