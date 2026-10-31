# VEGORA commerce

VEGORA is a Next.js storefront with a separate protected admin area. The customer-facing design follows the approved monochrome Gallery direction, with responsive women’s and men’s collections, search, product detail, and a browser-local shopping bag. The images in `public/editorial/` are temporary AI-generated visual concepts; the eight source photos represented in `public/catalog/` are client-supplied product photographs for seven men’s T-shirt styles.

## Run locally

Requires Node.js 24 or a compatible current Next.js runtime.

```bash
npm install
npm run dev
```

Open the Local URL printed by Next.js. Run `npm run typecheck`, `npm run lint`, `npm run build`, and `node --test tests/*.test.mjs` before release. On macOS with Google Chrome installed, `node scripts/visual-check.mjs` checks layout widths and mobile navigation against `http://127.0.0.1:3000`; set `VEGORA_BASE_URL` to point at another local preview.

## Firebase App Hosting preview

The editorial storefront preview is deployed at [vegora--vegoragh.europe-west4.hosted.app](https://vegora--vegoragh.europe-west4.hosted.app/). The `vegora` App Hosting backend is in `europe-west4`; `apphosting.yaml` supplies only public Firebase web identifiers and the project/bucket names. To deploy a reviewed local change to this backend, run `firebase deploy --only apphosting:vegora --project vegoragh`. Source archive rules in `firebase.json` exclude `.env.local`, build output, and dependencies.

This preview is for visual review. The seven supplied styles appear as static previews with descriptive placeholder names and a clearly marked GH₵100 test price. Their size, stock, and final price are unconfirmed, so they cannot be added to the bag. On 31 October 2026 the hosted catalog API returned 200 with no published products; admin sign-in, product Storage, and live catalog edits have not been verified. The admin import and editing UI is ready in code, but its full workflow must be tested against Firebase. Checkout remains closed.

## Admin and catalog

The admin panel is at `/admin`. The public Firebase web app is linked in `apphosting.yaml`; verify Firebase Auth, Firestore, Storage, rules, indexes, and the first admin claim before using it for live catalog management. Copy `.env.example` to `.env.local` and fill the values locally. App Hosting uses its managed server identity; local admin development still needs a service account. Follow [ADMIN_SETUP.md](ADMIN_SETUP.md) to configure the Firebase services and access. Do not commit credentials.

Product prices are stored as integer pesewas and displayed in GHS. Draft products remain hidden from the live catalog; the separate static preview of the seven supplied styles is visible while data setup is pending. An authorized operator can import those styles as editable drafts without overwriting existing slugs, then replace their provisional names and GH₵100 test prices, add confirmed sizes and stock, and publish them. The admin form supports up to 12 images per product, cover order, and standard or custom size variants.

The storefront currently leads with men. Women's links, collection tile, and editorial portrait appear automatically once a published women or unisex product has a price, image, and available stock. Until then `/women` returns 404, and unavailable products are omitted from public catalog/search results. Admins can tag products as `new_arrival` and/or `best_seller`; the seven supplied previews are presented as new arrivals, and imported drafts receive the new-arrival tag. The `/new-in` page filters published products by that tag.

## Checkout status

The shopping bag works locally in the browser. A **test-mode checkout foundation** now calculates totals from Firestore, quotes only configured delivery zones, reserves stock transactionally, initializes Paystack on the server, verifies callbacks and signed webhooks, records payment transitions, and releases unpaid reservations through a scheduled job. The admin can view order details once Firebase services are provisioned. New checkout remains **closed with `503`** until the test key, approved delivery zones, HTTPS callback, public webhook, expiry scheduler, and explicit enable switches are configured. No real or test payment has been processed.

See [ADMIN_SETUP.md](ADMIN_SETUP.md) for the checkout request contract, exact environment gates, webhook and scheduler setup, and test checklist. No server Firebase key or Paystack key has been deployed. The current code rejects live Paystack keys. A live release needs successful test-mode reconciliation plus owner-approved delivery, fulfilment, returns, tax, and customer service rules.

An order receives a `VG-…` reference after checkout initialization. The admin can read order details, but there are no fulfillment actions, carrier tracking numbers, customer delivery-tracking page, or editable site-content/CMS area yet. These must be designed and verified before presenting the admin as an operations dashboard.

## Visual assets

The SVG wordmark in `src/components/storefront/wordmark.tsx` uses the same shape in black on white and white on black. It is a code-native recreation based on the supplied raster logo. Replace it with the brand’s original vector master if one becomes available. The product previews use supplied photos; replace the temporary editorial concepts when approved campaign images are available.
