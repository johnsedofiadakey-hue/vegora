# Plan: home page new arrivals, and footer sign-up

Written 1 November 2026 before any code was changed, so a different agent can continue from where this stopped.
**Agents: tick the boxes as you finish steps and add a line to the Progress log at the bottom.** Read `CLAUDE_HANDOFF.md` first (status, traps) and `AGENTS.md` (this Next.js is not the one you know; read `node_modules/next/dist/docs/` before writing framework code).

## 1. The request (client's words, via the owner)

1. "These two pages on the home page removed and replaced with new arrival where people can see the new arrival and shop. After the new arrival, when you scroll down, you just go to the footer."
   The owner sent two screenshots of the live home page:
   - screenshot 1: section **01 / EXPLORE "The collections"** (Men tile, Women tile when women have stock),
   - screenshot 2: section **02 / THE FIRST PIECES "A closer look."** and section **03 / THE EDIT "A study in self-expression."**
2. "Beside the footer, just by the footer logo, client wants customers to sign up for deals or customization or anything, or new deals, or bulk purchase."

## 2. Decisions and assumptions (change them if the owner disagrees)

- **Removed from the home page:** collections tiles, "first pieces", "the edit" callout, and the closing "Elevate your style" block. The closing block goes because the owner wants the page to end at the footer after the new arrivals.
- **Kept:** the pinned hero and the short **introduction** under it ("Considered style. Distinct presence."). It was not in either screenshot. Easy to drop: delete its `<section className="home-intro ...">` in `src/app/(shop)/page.tsx` and the `intro*` fields from the `home` block.
- **New arrivals section** reuses `CatalogCollection` with `tag="new_arrival"`. It already shows real published products tagged New arrival, and falls back to the labelled preview products while there is no real stock, so it works today and when the owner publishes real products. Shows up to 8, with a "View all new in" link to `/new-in`. Clicking a card opens the product page, where the size is chosen and the piece is added to the bag. That is the "shop" path.
- **Sign-up** is a form in the footer, in the left column under the logo and tagline. Fields: email (required), interests (New deals, Customization, Bulk orders, Something else; at least one), optional name, phone or WhatsApp, and a short message (for bulk or custom details). A consent line sits next to the button. Spam: hidden honeypot field and rate limits.
- **Storage:** Firestore collection `signups`, one document per email (id = SHA-256 of the lowercased email), merged if the same person signs up again. **No email is sent** (no mail service yet), so the owner reads sign-ups in a new **Signups** tab in the admin, with filter by interest, copy-emails, CSV download, and delete (for removal requests).
- The server answers the same "thanks" whether or not the email was already known, so the form cannot be used to find out who is subscribed.
- The privacy policy page is still empty. Collecting personal data makes it more important: the owner must publish real privacy text (see `OWNER_GUIDE.md`). The consent line links to `/privacy` once that page is live.

## 3. State when this plan was written

- Repo `main` at `d77d37b`, working tree clean, `origin/main` identical. Live site is `https://vegora--vegoragh.europe-west4.hosted.app` (App Hosting backend `vegora`, project `vegoragh`).
- All checks green at that commit: typecheck, lint, 64 tests, build, `node scripts/visual-check.mjs` (needs a server on port 3000 and Google Chrome).
- **Unfinished work from earlier, independent of this task:** the custom domain. `www.shopvegora.com` (main) and `shopvegora.com` (forwards to www, temporary 302) are attached to the App Hosting backend and DNS at Namecheap is correct. The two names were removed from the old empty Firebase Hosting site at about 10:25 UTC, and what remains is waiting for the store to start answering on them. To finish: confirm `https://www.shopvegora.com` returns the VEGORA store (HTTP 200) and `https://shopvegora.com` redirects to it; then set `VEGORA_SITE_URL` in `apphosting.yaml` to `https://www.shopvegora.com`, deploy, and later make the redirect permanent (301) at launch. Status check: the domains resource under `firebaseapphosting.googleapis.com/v1beta/projects/vegoragh/locations/europe-west4/backends/vegora/domains`.
- Open and not mine to do: the Paystack test key, delivery zones, real catalog, policy text, mail service (see `CLAUDE_HANDOFF.md`).

## 4. Work breakdown

Do the steps in order. Each ends with something checkable.

### A. Home page: new arrivals replace four sections
- [x] `src/app/(shop)/page.tsx`: delete the collections, first-pieces, editorial-callout and closing sections. Insert a **new arrivals** section after the introduction: eyebrow, heading, one line of body text, `<CatalogCollection tag="new_arrival" limit={8} />`, and a `line-link` to `/new-in`. Remove now-unused imports (`featuredPieceImages`, `ContentImage` if unused, `WomenOnly` only if unused; the hero still uses `WomenOnly` and `ContentImage`).
- [x] `src/components/storefront/catalog-collection.tsx`: add an optional `limit` prop (default 48) that caps both published products and preview products. Keep the existing behaviour for every other caller.
- [x] `src/lib/site-content.ts`, block `home`: remove the fields for the deleted sections (`collections*`, `menTileImage`, `womenTileImage`, `arrivals*` old ones including `arrivalsProducts`, `callout*`, `closing*`). Add fields for the new section: `arrivalsLabel` (default "VEGORA / NEW IN"), `arrivalsLead` + `arrivalsEmphasis` (headline in the site's two-line style, default "The latest" + "arrivals."), `arrivalsBody`, `arrivalsLinkLabel` (default "View all new in"). Update the block `description`. Stored content with removed keys is ignored by `resolveValues`, so nothing live breaks.
- [x] Delete `src/lib/server/featured-pieces.ts` (the picker is gone) and the featured-pieces mention in docs.
- [x] `src/app/admin/content-editor.tsx`: nothing should need changing (forms come from the block definition); confirm the "featured pieces" picker code is still harmless or remove the `products` kind only if nothing else uses it.
- [x] CSS in `src/app/globals.css`: style `.home-new-arrivals` (padding like `.section-pad`, heading in the serif/italic style used elsewhere, product grid inherits `.product-grid` / `.preview-product-grid`). Optional cleanup: delete the dead rules for `.home-collections`, `.collection-tile*`, `.tile-*`, `.home-arrivals*`, `.editorial-callout`, `.editorial-photo`, `.editorial-copy`, `.closing-statement` (also inside the media queries).
- [x] Update tests: `tests/site-content.test.mjs` (homepage defaults, the featured-products test, any use of removed fields).
- Acceptance: home page is hero, intro, new arrivals, footer, nothing between. Cards link to product pages. `/the-edit`, `/men`, `/new-in` still work. No sideways scroll at 320, 390, 768, 1440 px.

### B. Sign-up: shared rules and server
- [x] `src/lib/signup.ts` (pure, no server imports; import siblings with explicit `.ts` extensions): `signupInterests` (`deals`, `customization`, `bulk`, `other`) with labels, `parseSignup(input)` returning cleaned values or throwing `SignupInputError` (email format and length, name up to 100, phone `+`/digits/spaces/brackets/dashes 7 to 20 characters, interests 1 to 4 and unique, message up to 500, consent must be `true`, honeypot `website` must be empty, plain text only: no HTML tags, no control or bidi characters), and `signupId(email)` helper if it can stay pure (otherwise in the server file).
- [x] `src/lib/server/signups.ts`: `saveSignup` (upsert by id, merge interests, keep first `createdAt`, update `updatedAt`, latest name, phone and message when given), `listSignups` (newest first, cap 500, report `truncated`), `deleteSignup(id)` with id validation.
- [x] `src/app/api/signup/route.ts` (POST, public): rate limit with `createRateLimiter` (per caller 10 and per email 3 per 10 minutes, same pattern as `src/app/api/orders/track/route.ts`), `readJson`, `parseSignup`, honeypot returns the same success silently, always `{ ok: true }` for valid and duplicate requests, `Cache-Control: no-store`.
- [x] `src/app/api/admin/signups/route.ts` (GET, `requireAdmin`) and `src/app/api/admin/signups/[id]/route.ts` (DELETE, `requireAdmin`).
- [x] Firestore rules need no change (all client access is denied; the Admin SDK is used).
- [x] `tests/signup.test.mjs`: parsing, every rejection, interests, honeypot, consent, id stability.
- Acceptance: unit tests pass; against the emulators a valid POST stores one document, a repeat merges, a bad payload gets 400, the 4th request for one email in ten minutes gets 429, the admin list needs a token and a non-admin gets 403.

### C. Sign-up: footer form
- [x] `src/components/storefront/footer-signup.tsx` (client): heading and one line ("Deals, customization and bulk orders."), interest chips (real checkboxes, "New deals" ticked by default), email, a "More details (optional)" disclosure with name, phone or WhatsApp and message, hidden honeypot input (`name="website"`, `tabIndex={-1}`, `aria-hidden`), consent text, submit button. States: idle, sending, success ("Thank you. We will be in touch about..."), error (shows the server message), disabled while sending. Labels tied to inputs, visible focus, works at 320 px.
- [x] `src/components/storefront/site-footer.tsx`: render it in the left column under the tagline; pass `privacyHref` (`/privacy` only when `policyIsLive(privacy)`).
- [x] CSS in `src/app/globals.css` for the dark footer: `.footer-signup*`. On a phone it stacks under the logo and above the link columns.
- Acceptance: submitting from the footer on any shop page stores a sign-up; success replaces the form; keyboard only works; no layout break at 320 to 1440 px.

### D. Admin: Signups tab
- [x] `src/app/admin/signups-panel.tsx` (client, takes `adminFetch`): list with date, name, email, phone, interest labels, message; filter by interest; "Copy emails" for the filtered list; "Download CSV" (client side, escape quotes and guard against spreadsheet formula injection by prefixing `'` to cells starting with `=`, `+`, `-`, `@`); delete with an on-page confirmation (native `confirm()` is suppressed in the in-app browser); empty state; truncated notice.
- [x] `src/app/admin/page.tsx`: add the tab (view `"signups"`), mount on first visit and keep mounted like the Content tab. Keep the existing branches working.
- [x] Styles in `src/app/admin/admin.module.css`.
- Acceptance: with the emulators, sign up from the footer, then see it in the tab, filter, copy, download, delete.

### E. Docs, verification, handover
- [x] `ADMIN_SETUP.md`: new home layout, the sign-up contract (endpoint, fields, limits, storage, privacy), the admin routes.
- [x] `OWNER_GUIDE.md`: the new home page, the Signups tab, a plain note that no email is sent yet and that the privacy policy text should be published because personal data is collected. Keep the published copy in sync if asked (an earlier version was published as an Artifact; republish with the same file path only if the owner wants it).
- [x] `CLAUDE_HANDOFF.md`: add the sign-ups and the new home page to the status; list any follow-ups.
- [x] Run `npm run typecheck`, `npm run lint`, `node --test tests/*.test.mjs`, `npm run build`, then `node scripts/visual-check.mjs` against `npm run start` (set `VEGORA_BASE_URL`, default `http://127.0.0.1:3000`).
- [x] Browser check against the emulators at phone and desktop width (home page, footer form, admin Signups tab). See the handoff for the emulator setup (Java 21, a config file outside the repo, build with `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` for the admin sign-in, never ship that build).
- [x] Commit in logical commits. **Do not push or deploy without the owner's go-ahead.** Deploy command: `firebase deploy --only apphosting:vegora --project vegoragh`. After a deploy, check the live pages and `/api/signup` (a dry POST with a bad body should return 400, not 500).

## 5. Gotchas that apply here (details in `CLAUDE_HANDOFF.md`)

- Shop pages are `force-dynamic`; content reads are cached 30 seconds per instance.
- Uploaded or site photographs go through `/api/image` (the custom loader); App Hosting has no `/_next/image`.
- Node tests import `.ts` directly: explicit `.ts` extensions between shared files, no constructor parameter properties, no server-only imports in shared files.
- The Content admin forms are generated from the block definition in `src/lib/site-content.ts`; changing a field there changes the form, validation, defaults and docs together.
- In this machine's shell (zsh) unquoted variables are not word-split; use `bash -c` for loops.
- Cloud Run logs any 5xx as an ERROR. `/api/checkout/zones` answers 503 on purpose while checkout is closed, and the alert policy ignores exactly that.
- Writing to Secret Manager is blocked for the agent; the owner must run those steps.

## 6. Progress log

Newest last. Format: date, who, what, what is left.

- 2026-11-01 (Claude): plan written; no code changed yet.
- 2026-11-01 (Claude): **A done** (home is hero, intro, new arrivals, footer; `home` content block trimmed; `featured-pieces.ts` and the unused `products` field kind removed; 63 tests passed). **B done** (shared rules, server storage, public `POST /api/signup`, admin list and delete routes, 8 unit tests). Left: C footer form, D admin Signups tab, E docs and verification. The optional dead-CSS cleanup in A is not done.
- 2026-11-01 (Claude): **custom domain is serving.** `https://www.shopvegora.com` returns the store with a valid certificate, `https://shopvegora.com` forwards to it (302), http upgrades to https. `apphosting.yaml` now has `VEGORA_SITE_URL=https://www.shopvegora.com` but this is **not deployed yet**: it ships with the next deploy together with this work. After that deploy, check `/sitemap.xml` and share previews show the new address, and tell the owner the Paystack return address will use it. Make the bare-domain redirect permanent (301) only at launch. Firebase showed the bare domain as `HOST_NON_FAH` / certificate propagating but it already answers correctly.
- 2026-11-01 (Claude, continuing after the previous session ran out of credits): **C, D and E done except the commit.** Footer form and admin Sign-ups tab finished and checked. Fixed the admin tab bar overflowing on phones (it now fits at 320 px, and scrolls inside the bar rather than widening the page if more tabs are added), plus an older bug where the product editor's hidden photo picker widened the page at 320 px (now `hidden`, like the Content editor). Verified: typecheck, lint, 72 tests, build, `node scripts/visual-check.mjs` (320/390/768/1440, no sideways scroll), and against the emulators: valid sign-up 200, repeat merged, bad body 400, honeypot not stored, 4th request for one email 429, admin list 401 without a token, footer submit from the page at 375 px, Sign-ups tab filter and Remove at 320 px. Committed locally; **not pushed or deployed** (needs the owner's go-ahead; the deploy also ships `VEGORA_SITE_URL=https://www.shopvegora.com`). The optional dead-CSS cleanup in A is still not done. The local `.next` is an emulator build (Auth emulator host baked in); App Hosting builds from source and ignores `.next`, but run a plain `npm run build` before any local production test.
