# VEGORA admin and commerce setup

The storefront can render before services are configured. Catalog APIs return `503` until server Firebase credentials are present. The admin panel is at `/admin`.

## Firebase configuration

The `vegoragh` Firebase web app is connected in `apphosting.yaml`. For local admin development, enable Authentication (Email/Password), Firestore, and Cloud Storage, then put the following values in `.env.local`. App Hosting uses its managed identity for the server and does not need a downloaded service-account key. Never commit local private-key values.

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=
```

`FIREBASE_PRIVATE_KEY` may contain literal `\\n` sequences; the server converts them to newlines. The client Firebase values identify the project and are public. The local service account values are secrets and must remain server-side. Do not use a service account key in browser code.

Deploy `firestore.rules`, `storage.rules`, and `firestore.indexes.json` for the matching project before publishing products. Both rule sets deny direct client access. The Next.js server authenticates each admin request and uses the Admin SDK. Create the first admin user in Firebase Authentication, then run `node scripts/grant-admin.mjs admin@example.com` with the server credentials in your shell environment. Sign out and back in after the claim is set. Only trusted operators should receive this claim.

## Catalog contract

- `GET /api/products?audience=women|men&limit=12` returns `{ products: Product[] }`, published only. Unisex items appear in both collections.
- `GET /api/products?q=term&limit=12` searches published name, category, description, and slug. This initial search supports a catalog smaller than 500 items and fails clearly at that ceiling; add a search index before growing past it.
- `GET /api/products/[slug]` returns `{ product }` for a published item; drafts and archived items return 404.
- `GET/POST /api/admin/products` and `GET/PUT/DELETE /api/admin/products/[slug]` require a Firebase ID token with `admin: true`. DELETE archives the product. Slugs are immutable after creation.
- `POST /api/admin/upload` accepts one JPEG, PNG, WebP, or AVIF file up to 8 MB and returns `{ url }`. Images are served at `/api/media/[assetId]`.
- The admin form can select several files at once and uploads them through the protected endpoint one by one. A product can keep up to 12 images; the first is its cover image, and the form supports reordering and alt text. Existing `images` arrays stay compatible.
- Standard and custom sizes can be added in the admin form. Every size has its own variant ID, SKU, and stock count. New sizes start at zero stock until an operator enters verified inventory. Existing `variants` arrays stay compatible.
- The admin's **Import seven preview styles** action copies the seven supplied men's T-shirt styles into Firestore as editable drafts. The navy front and back photographs are one product. Each new draft has a GH₵100 test price, no sizes or stock, and is not published. Existing slugs are skipped without changes. The static `/catalog/` photos from this known preview list are accepted in product edits; other local paths and remote URLs are rejected. Once Firebase is available, review each draft and enter confirmed names, prices, sizes, and stock before publishing.
- Prices use integer pesewas (`priceMinor`) and `currency: "GHS"`. A product may stay a draft with no price or image. Publishing requires a price, image, and at least one size variant.
- Admins can set `new_arrival` and `best_seller` tags in the product editor. New products default to New arrival; imported preview drafts carry that tag. `/new-in` filters by `new_arrival`, and product cards/detail pages show assigned tags. The two tag queries require the indexes in `firestore.indexes.json` to be deployed and ready.
- Public catalog/search/detail routes show published products with a price, image, and at least one available unit. Women's navigation and the `/women` page appear only when such a women or unisex product exists; the availability endpoint is `/api/storefront/availability` and fails closed if catalog access is unavailable.

## Site content (CMS) contract

Editable site text lives in Firestore `siteContent/{block}` with one document per block: `announcement`, `home`, `edit`, `about`, `contact`, `delivery`, `returns`, `privacy`, `terms`. Each holds a `draft`, a `published` copy, and a `version`; every publish also writes `siteContent/{block}/revisions/v{version}`. The field list, limits and built-in default text for each block are defined in `src/lib/site-content.ts`. A block that has never been published uses those defaults, so the storefront never depends on this data existing.

All routes require an admin ID token. Saving a draft never changes the live site.

- `GET /api/admin/content` lists every block with its fields, status (`default`, `draft`, `published`, `changed`), editor values and live values.
- `GET /api/admin/content/[block]` returns one block and its last 20 published versions.
- `PUT /api/admin/content/[block]` with `{ values, version }` saves a draft. Fields not sent keep their current value; unknown fields are rejected.
- `POST /api/admin/content/[block]/publish` with `{ version }` makes the draft live and records a revision. The instance that handled the request shows the new text immediately.
- `POST /api/admin/content/[block]/discard` with `{ version }` drops unpublished changes.
- `POST /api/admin/content/[block]/restore` with `{ revisionId, version }` loads an earlier published version into the draft. It goes live only when published.

`version` must match the stored version, otherwise the request returns 409, so two editors cannot silently overwrite each other. Content is plain text: HTML tags and control characters are rejected, links must be a page on this site or an `https://` address, and images must be admin uploads or the approved `/editorial/` photographs, each with a description. The homepage is the hero, a short introduction and a new-arrivals section; the arrivals are not content but the catalogue's products tagged `new_arrival` (first eight), rendered by `CatalogCollection` with a `limit`. The storefront reads this content for the homepage, The Edit, About and the footer tagline. Shop pages render per request (`dynamic = "force-dynamic"` in the shop layout) so text is never frozen at build time, and each server instance keeps a 30-second in-process copy of each block. Publishing clears the copy on the instance that handled it; another instance can show the previous text for up to 30 seconds. Content reads give up after 3 seconds and fall back to the last good copy, or the built-in wording, so a Firestore outage slows a page by at most a few seconds and never breaks it. Uploaded photographs are served unoptimized, like product photographs; use a web-sized image (under about 1 MB). The admin's **Content** tab edits all nine sections: a form built from the field list in `src/lib/site-content.ts`, with character counters, an uploader or approved-photo chooser for images (a new upload clears the old description, which must be rewritten), Save draft, Publish and Discard with an on-page confirmation, earlier versions with Load into draft, and a "reloaded" path when another admin changed the section. Unsaved edits survive switching sections and tabs. The `/delivery`, `/returns`, `/privacy`, `/terms` and `/contact` pages are served from the blocks of the same names and answer 404 until they have text (or, for contact, at least one channel); the footer links to each only once it is live. The `announcement` block shows as a one-line bar above the header on every shop page while it is switched on and has a message. Still to come: a draft preview.

To try the admin without touching the live project, run the Firestore, Auth and Storage emulators, build with `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, and start the app with `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST` and a demo `FIREBASE_PROJECT_ID`. Leave that variable unset for every real build. The Firestore emulator needs Java 21 or newer. The hero and The Edit's second portrait switch automatically with women's stock and are not editable.

## Footer sign-ups

The footer form (`src/components/storefront/footer-signup.tsx`) posts to the public `POST /api/signup` with `{ email, interests:["deals"|"customization"|"bulk"|"other"], consent:true, name?, phone?, message?, website? }`. Validation lives in `src/lib/signup.ts` (shared, no server imports): consent must be `true`, one to four known interests, a valid email, plain-text limits (message 500). A non-empty `website` field is a honeypot and gets the same `{ ok:true }` without saving. The route allows 10 requests per caller and 3 per email per 10 minutes (429 after that) and answers identically for new and repeat emails. Records live in Firestore `signups/{sha256(email) first 32 hex chars}` (`src/lib/server/signups.ts`): a repeat submission merges interests, keeps `createdAt` and increments `count`.

Admin routes (Firebase ID token with `admin: true`): `GET /api/admin/signups` returns the newest 500 (`{ signups, truncated }`) and `DELETE /api/admin/signups/[id]` removes one (id is 32 hex characters). The admin **Sign-ups** tab filters by interest, copies emails, downloads a CSV (cells starting with `= + - @` are prefixed with an apostrophe against spreadsheet formula injection) and deletes with an on-page confirmation. No email is sent to sign-ups; there is no mail service yet. Firestore rules deny all client access, as for every collection.

## Checkout gate

For local key setup, copy `.env.example` to `.env.local`, paste only the Paystack **Test Secret Key** into `PAYSTACK_SECRET_KEY=`, then run `npm run check:paystack`. The check contacts Paystack and reports acceptance without printing the key. The hosted checkout does not need a browser public key. `.env.local` is Git-ignored. Keep checkout switches unset while delivery rules and the public test webhook are being prepared.

The test-mode order flow is implemented but **closed by default**. `POST /api/checkout` returns 503 until all required server settings below are present. There is no live-mode payment path. The store must not take money or promise an order yet.

```dotenv
PAYSTACK_SECRET_KEY=sk_test_...
VEGORA_SITE_URL=https://your-test-domain.example
VEGORA_DELIVERY_ZONES_JSON=
VEGORA_CRON_SECRET=
VEGORA_WEBHOOK_CONFIRMED=true
VEGORA_EXPIRY_JOB_CONFIRMED=true
VEGORA_CHECKOUT_ENABLED=true
```

Do not set the three `true` switches until the linked test services have been configured and verified. `PAYSTACK_SECRET_KEY` stays server-side. `VEGORA_SITE_URL` must be HTTPS and have a `/checkout/return` page. `VEGORA_CRON_SECRET` must be at least 32 characters and known only to the scheduled job. `VEGORA_DELIVERY_ZONES_JSON` is an array of approved zones, each with `{ id, label, region, cities?, feeMinor }`; `feeMinor` is an integer amount in pesewas. If `cities` is omitted, the quoted rate applies to the whole named region. The server matches the customer's region and city against the zone, so the client cannot choose a cheaper region. No zones or fees are supplied by the app.

The Paystack test dashboard webhook must point to `https://your-test-domain.example/api/paystack/webhook`. Configure a scheduler to `POST /api/internal/expire-orders` with `Authorization: Bearer <VEGORA_CRON_SECRET>` at least every five minutes. The job checks Paystack before releasing pending reservations, then expires unpaid reservations after 30 minutes. A payment that succeeds after release is marked `review_required` for manual resolution; stock is never silently oversold. Webhook handling verifies the raw-body HMAC signature and independently verifies transaction status, amount, currency, reference, environment, and customer email. Repeated callbacks/webhooks do not capture stock twice. Order transitions also write `paymentEvents` records with reference, action, provider status, amount, and timestamp; no card details are stored.

The shopper contract is `POST /api/checkout` with `{ email, customer:{name,phone}, delivery:{zoneId,addressLine1,addressLine2?,city,region,notes?}, items:[{slug,variantId,quantity}], idempotencyKey }`. The key must be a random UUID v4. A successful test initialization returns `{ orderId, reference, authorizationUrl }`. `GET /api/checkout/zones` returns approved fee quotes; `GET /api/checkout/verify?reference=...` returns only `{status}`. The admin can read orders at `/admin` and `GET /api/admin/orders`.

Customers see a short order number instead, such as `VG-7K2M9QXA`: eight characters derived from the reference (`shortOrderCode` in `src/lib/fulfillment.ts`), stored on each new order as `shortCode`, and shown on the confirmation page, the Track page and the admin order header. The Track page accepts the short number (any case, with or without the dash) or the long reference, together with the order email; a short number shared by two orders is resolved by the email. The `VG-…` value is the internal order/payment reference. It is not a courier tracking code. Manual delivery updates use `GET/PATCH /api/admin/orders/[reference]` with an admin token. Only a verified `paid` order can move through `unfulfilled → preparing → dispatched → delivered`; an operator can undo one step before delivered, which is final. Dispatch requires a provider and tracking reference, which the operator enters manually. Each change and optional internal note is recorded under `orders/{reference}/fulfillmentEvents`. `POST /api/orders/track` accepts `{ reference, email }` and returns only payment/fulfillment status, timestamps, provider/reference when dispatched, and active status milestones. It returns no address, customer name, phone, admin identity, or internal notes. The customer page is `/track`. There is no carrier API integration or CMS editor. The synthetic paid-order flow passed with an admin account in local Firebase Auth and Firestore emulators on 31 October 2026, including lookup privacy, status changes, correction, notes, and delivered finality. Repeat with a real-project admin and a Paystack test order before treating hosted tracking as operational.

Before opening test checkout, use synthetic products and orders to verify initialization, successful and failed callbacks, signed webhook delivery, webhook retry/idempotency, amount mismatch handling, reservation expiry, stock reconciliation, and admin order display. Then confirm delivery regions and rates, returns, tax handling, order notifications, and fulfillment ownership before live mode. Live keys are rejected by the current code.

Paystack guidance: [accept payments](https://paystack.com/docs/payments/accept-payments/), [verify payments](https://paystack.com/docs/payments/verify-payments/), [webhooks](https://paystack.com/docs/payments/webhooks/).

## Operations notes

- **Backups.** Firestore point-in-time recovery is on (7 days). Restore with `gcloud firestore databases restore` or the console; do not rely on it for anything older than a week.
- **Expiry job.** Cloud Scheduler job `vegora-expire-orders` calls `POST /api/internal/expire-orders` every five minutes with `VEGORA_CRON_SECRET`. Create or repair it with `scripts/setup-checkout-services.sh`. App Hosting pins a secret to the version that was current at rollout, so after rotating the secret, update the job header and redeploy before disabling the old version.
- **Rate limits.** Order tracking allows 8 attempts per email and 40 per caller every 10 minutes; starting a checkout allows 5 per email and 12 per caller. The count is held in memory on each server instance, so with several instances the real limit is higher; the caller address comes from `x-forwarded-for`, which a client can influence. Treat it as a brake on guessing and spam, not a guarantee.
- **Photos.** App Hosting does not serve Next.js's built-in `/_next/image` optimizer, so every photograph goes through our own route, `/api/image?src=...&w=...&q=...`, via the custom loader in `next.config.ts`. It accepts only uploaded photographs (`/api/media/<uuid>.<ext>`) and files in `/catalog` and `/editorial`, at a fixed list of widths, and returns WebP resized to that width with the camera rotation applied and location metadata removed. A 4 MB upload is a few tens of KB on a phone, and the site's 1.5 to 2 MB editorial PNGs come out at 11 to 51 KB. If a file cannot be resized the original is served, so a photograph never disappears. Admin screens still show originals.
- **Admin order list** shows the newest 200 orders and says so when there are more.
- **Search engines.** The site is closed to them (`robots.txt` disallows everything and pages carry `noindex`) until `VEGORA_ALLOW_INDEXING=true` is set at launch, because the preview shows test prices. `VEGORA_SITE_URL` must then be the public address: it feeds the sitemap, canonical links and share previews. `/sitemap.xml` lists only pages that exist (no empty policy pages, no women's collection without stock). Product pages carry a title, description, share image and Product markup when the piece is published and in stock; preview pieces and unknown addresses are `noindex`.
- **Monitoring** (Google Cloud project `vegoragh`). Uptime checks "VEGORA home page" and "VEGORA catalog API" run every five minutes. Alert policy "VEGORA site is down" fires when either fails from more than one location; "VEGORA server errors" fires on any ERROR log from the site or the expiry job, at most once an hour. Both email the channel "VEGORA alerts (email)"; change the address under Monitoring, Alerting, Edit notification channels. While checkout is closed, `/api/checkout/zones` answers 503 on purpose and the bag page asks it on every visit, so the errors policy ignores exactly that response. **Remove that exclusion from the policy when checkout opens**, otherwise a genuine failure of that endpoint would go unreported.
