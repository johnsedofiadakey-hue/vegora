# VEGORA handoff for Claude

## Status update (31 October 2026, evening). Read this first

It replaces the "Current snapshot" below wherever they differ.

**Built and deployed** (see `ADMIN_SETUP.md` for the contracts, `OWNER_GUIDE.md` for the owner):
- Admin with Products, Orders and **Content** tabs. Manual delivery workflow (preparing, dispatched, delivered, one-step undo, internal notes), `/track` with a short order number (`VG-7K2M9QXA`) plus email, and a CMS of nine sections (announcement bar, homepage, The Edit, About, contact and footer, delivery, returns, privacy, terms). Policy pages stay hidden until they have text.
- Hardening: Firestore point-in-time recovery (7 days), rate limits on tracking and checkout, cron secret and the five-minute `vegora-expire-orders` Scheduler job, uptime checks and email alerts (Cloud Monitoring, sent to the project owner), a photo route (`/api/image`), and SEO (sitemap, robots, share previews, product markup) that is **closed to search engines until `VEGORA_ALLOW_INDEXING=true`**.
- Phone path to checkout: sticky add-to-bag bar, bag count in the header, no pre-selected delivery area.

**Still to do, in order**
1. **Paystack test key** (the owner brings it): `firebase apphosting:secrets:set PAYSTACK_SECRET_KEY --project vegoragh`, then set the webhook in the Paystack dashboard to `<site>/api/paystack/webhook`. Also needs the owner's **delivery zones** (`VEGORA_DELIVERY_ZONES_JSON`, integer pesewas; never invent them). Then run the synthetic end-to-end cases and only then set the three checkout switches. The expiry job, site URL and cron secret are already in place.
2. Decisions: a mail service and sender address for order emails, cancel and refund rules, tax. Live payments need a separate implementation, review and the owner's approval (the code rejects live keys).
3. Owner content: real names, prices, sizes, stock, women's products, policy text, contact details, custom domain.
4. Optional: CMS draft preview, "notify me" signup, delivery estimate in the bag, mobile money shown at checkout.
5. Launch: set `VEGORA_ALLOW_INDEXING=true` and a custom-domain `VEGORA_SITE_URL`.

**Not yet verified on the live site:** publishing through the live admin (needs the owner's sign-in), the photo route's resizing on Cloud Run, and the alert emails. A real order has never gone end to end.

**Things that cost time, so you do not repeat them**
- **App Hosting does not serve `/_next/image`.** Photographs go through our own route via the custom loader in `next.config.ts`. It looked fine locally and was a 404 live. Always check the live site, not only `next start`.
- **Secrets:** App Hosting pins a secret to the version current at rollout, so rotating needs a redeploy before disabling the old version. A trailing newline in a stored secret made the expiry endpoint refuse its own scheduler (the server now trims). `gcloud scheduler jobs create` prints the job, headers included, so discard its output.
- The auto-mode classifier blocks writes to Secret Manager. Ask the owner to run the step or to add a permission rule. Do not look for another route.
- Shop pages are `force-dynamic` and read content through a 30-second per-instance cache kept on `globalThis` (route handlers and pages are separate module graphs). Another instance can lag a publish by 30 seconds.
- Local emulators: the Firestore emulator needs **Java 21+** (`/opt/homebrew/opt/openjdk@21`). The repo's `firebase.json` has no emulator section, so use a config file elsewhere. Build with `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` to sign in to the admin against the Auth emulator. Never ship that build.
- Node tests import `.ts` files directly: use explicit `.ts` extensions between shared files (`allowImportingTsExtensions` is on), and avoid constructor parameter properties.
- In the in-app browser: a hidden pane gives stale screenshots (show it with `mcp__ccd_view__show_pane`), native `confirm()` is suppressed (the admin uses on-page confirmations), and `form_input` does not trigger React's change handler on checkboxes, so use real clicks.
- Another editor (Codex) has worked in this repo at the same time. Check file timestamps and `git status` before editing shared files.

**Monitoring and jobs in project `vegoragh`:** Scheduler job `vegora-expire-orders` (europe-west4), uptime checks "VEGORA home page" and "VEGORA catalog API", alert policies "VEGORA site is down" and "VEGORA server errors", email channel "VEGORA alerts (email)".

## Mission

Take VEGORA from its current visual preview to a working, tested Ghana ecommerce storefront. Own the admin, catalog, backend, checkout, and release readiness work. Preserve the approved luxury storefront design while completing the operational path. Work in this repository; verify the actual Firebase and Paystack state before changing configuration or claiming a feature works.

## Current snapshot (29 October 2026)

- Repository: `https://github.com/johnsedofiadakey-hue/vegora`, branch `main`, current baseline `a5b2476` (`Add supplied product previews and flexible admin product editing`). The working tree was clean when this note was written.
- Hosted visual preview: `https://vegora--vegoragh.europe-west4.hosted.app/` on Firebase App Hosting backend `vegora` in `europe-west4`, project `vegoragh`.
- The black/white identity with oxblood accent, reversible wordmark, pinned hero/overlapping scroll, responsive collections, search, product details, bag, and footer admin link are present. The editorial images are temporary concepts.
- Eight client-supplied photos in `public/catalog/` represent seven men's T-shirt styles. The navy front and back are one style. These are **static previews**, with provisional names and GH₵100 test prices. They are intentionally not purchasable because real sizes, stock, and final prices have not been confirmed. No client women's catalog has been supplied yet.
- `/admin` has a protected UI and code for importing the seven previews as editable drafts, editing products, uploading multiple images (up to 12), choosing cover/order/alt text, and adding standard or custom size variants with SKU and stock. Admin sign-in and live saves have **not** been verified against provisioned Firebase services.
- The test-mode checkout foundation includes server-priced totals, delivery zone matching, transactional stock reservations, Paystack initialization/verification/webhook handling, reservation expiry, payment events, and an admin order read view. Checkout is deliberately closed; no end-to-end test transaction is recorded. Live Paystack keys are rejected by current code.
- Fresh hosted checks on 29 October 2026: `GET /api/products?limit=1&audience=men` returned **500**; `GET /api/checkout/zones` returned **503**. The Firebase CLI could not list Firestore databases from this environment. Diagnose the 500 and verify provisioning/permissions rather than assuming its cause.

## Decisions already made

- Launch market is **Ghana**, currency **GHS**, payment provider **Paystack**.
- The client will edit final names and prices in the admin portal. GH₵100 is a test placeholder, not an approved selling price.
- The owner has **not yet defined Ghana delivery regions and fees**, nor confirmed sizes and stock. Do not invent these or publish the previews as sellable products.
- Paystack test account is available. Secrets must be configured locally or in managed server secrets; never request keys in chat, print them, or commit them.

## Read first

1. `AGENTS.md`: this Next.js version has breaking changes. Before editing code, read the relevant guide under `node_modules/next/dist/docs/`.
2. `README.md` and `ADMIN_SETUP.md`: existing architecture, setup, environment gates, contracts, and test checklist.
3. `apphosting.yaml`, `firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `.env.example`.
4. Relevant implementation: `src/lib/server/`, `src/app/api/`, `src/app/admin/`, `src/components/storefront/`, and `tests/`.

## Work plan and acceptance gates

### 1. Make Firebase and the admin catalog work

- Check the actual Firebase project and permissions. Enable/verify Email/Password Authentication, Firestore, and Cloud Storage. Deploy the repository's rules and indexes to the correct project. Use managed identity for App Hosting and a local service account only when needed for local development; keep private credentials out of Git.
- Investigate the hosted catalog **500** with logs and an authenticated server-side check. Make failures actionable and keep the public API limited to published products.
- Create or guide creation of the first trusted admin account and assign the `admin: true` custom claim using `scripts/grant-admin.mjs`. Verify sign-in, authorization boundaries, draft save/edit/archive, image upload and retrieval, image ordering, size variants, and stock updates with a signed-in admin session.
- Import the seven supplied preview styles as **drafts**. Confirm the navy front/back images remain in one product. Keep drafts hidden from the public catalog until the owner enters real sales data and explicitly publishes them.
- Acceptance: a signed-in admin can manage a draft and its images/sizes; a non-admin cannot; a published synthetic product appears through `/api/products`; draft products do not. The hosted catalog endpoint no longer fails with 500.

### 2. Complete Ghana test checkout

- Obtain approved delivery zones, city/region matching rules, and fees from the owner. Use integer pesewas in `VEGORA_DELIVERY_ZONES_JSON`; do not create a default fee or silently accept an unmatched address.
- Configure the Paystack **test** secret as a server-side secret, the HTTPS callback URL, a signed public webhook endpoint, and the authenticated reservation-expiry scheduler as described in `ADMIN_SETUP.md`. Keep the three checkout enable switches off until their respective service checks pass.
- Run synthetic end-to-end cases: initialization, successful and failed payment, callback, webhook delivery and retry, amount/currency/reference mismatch, duplicate requests, reservation expiry, stock reconciliation, and admin order visibility. Check both Paystack and the application ledger. Record concrete evidence and any limitations.
- Acceptance: test checkout quotes the approved delivery fee, takes a Paystack test payment, updates order/stock exactly once, and recovers correctly from retries/failures. Only then open **test** checkout on the preview.

### 3. Finish store operations and content

- Add or complete admin fulfillment controls and a clear workflow for packing, dispatch, cancellation, refunds/returns, and customer communication. Agree on order notifications and who handles support. Avoid implying a paid order is fulfilled merely because payment succeeded.
- Gather owner-approved product names, final GHS prices, sizes, stock quantities, and women’s products/photos. Replace temporary editorial images only with approved assets. Review product copy, size guidance, contact information, delivery/returns policy, and tax treatment with the owner.
- Keep unconfirmed products as drafts or labelled previews. Confirm that the original vector logo, if supplied, replaces the code recreation without breaking light/dark contrast.

### 4. Review and release

- Before each release run `npm run typecheck`, `npm run lint`, `npm run build`, and `node --test tests/*.test.mjs`. Run `node scripts/visual-check.mjs` locally, then check hosted phone/tablet/desktop widths, mobile navigation, product gallery, admin, and checkout. The visual check uses `domcontentloaded` plus explicit rendered-state waits for the hosted app.
- Push reviewed changes to GitHub and deploy only the relevant Firebase targets. For this preview backend the App Hosting command is `firebase deploy --only apphosting:vegora --project vegoragh`. Verify the distinctive live behavior and APIs after rollout; do not treat a successful build or deploy command as proof of a working store.
- Keep **live** payments closed until the owner approves delivery, fulfillment, returns, tax, support, real catalog inventory, and a successful test-mode reconciliation. Current code has no live-mode path; that requires separate implementation, review, and verification. Obtain explicit approval before the final live release.

## Report back to the owner

Give a short status for each phase: implemented, locally tested, hosted verified, or blocked. Include the exact remaining owner decisions and any access/configuration problem. Distinguish preview visuals, draft catalog, test checkout, and live commerce. Never describe this as launch-ready while a catalog API fails, checkout is closed, or real inventory and delivery rules remain unconfirmed.

## Client direction added 31 October 2026

The client wants the public store to lead with men's wear until women’s products have real stock. The storefront now hides women's entry points until a published women or unisex product has price, image, and available stock; once one exists, links and imagery appear automatically. The product editor now supports New arrival and Best seller tags; all seven supplied styles are New arrival previews. Keep the women stock rule and tags intact as the catalog work continues.

The client also expects a fuller admin comparable to other ecommerce sites: reliable product adding/editing, operational order management, editable site content, order ID, and customer delivery tracking. The `VG-…` value is an order/payment reference, not a carrier tracking code. On 31 October the Orders tab was read-only and there was no CMS or tracking page; see the later manual-tracking update below. The live catalog endpoint returned **200 with an empty published catalog** on 31 October; `/api/checkout/zones` still returned **503**. Earlier 500/503 results above are historical and must not be repeated as current status.

For the admin completion, make each area operational rather than adding placeholder navigation:

- **Products:** verify create/edit/archive, multiple images, size-level stock, prices, draft/publish, and New arrival/Best seller tags with a signed-in admin. Keep the seven preview styles as drafts until the owner supplies real names, prices, sizes, and stock.
- **Orders:** verify the guarded manual fulfillment transitions, one-step correction, internal notes, event timeline, provider, and tracking reference against synthetic paid orders. Add agreed cancellation/refund controls. Keep payment status separate from fulfillment status; a paid order is not automatically dispatched.
- **Customer tracking:** verify the `/track` page and reference-plus-email lookup with real test data, including mismatched emails and privacy checks. The `VG-…` value is the order ID; the admin-entered delivery reference is separate. No courier integration is configured.
- **CMS:** agree which homepage/editorial, announcement, policy, and contact fields the owner needs to edit. Provide draft, preview, publish, image handling, and safe text validation. Do not store arbitrary HTML from the admin as executable page content.
- **Verification:** exercise real admin credentials and synthetic orders in the configured environment, including unauthorized access, payment/order status boundaries, tracking lookup, edits, and reload persistence. Do not call the admin complete based only on local rendering.

## Manual tracking decision and implementation

The owner chose **manual delivery status and reference first**. Code now provides guarded admin delivery updates with internal notes and one-step corrections, a delivery-event history, and a `/track` customer page that requires order reference plus matching email. Delivery moves from unfulfilled to preparing, dispatched, and delivered only after verified payment; dispatch requires the operator to enter provider and reference. Unit and UI checks passed; a synthetic paid order and admin account also passed the full flow in local Firebase Auth and Firestore emulators on 31 October 2026. Real-project admin sign-in and a Paystack test order remain unverified because checkout is still closed. Add customer notifications, refund/cancellation handling, and the agreed CMS before treating the admin as fully operational. No courier integration has been promised.
