# VEGORA commerce

VEGORA is a Next.js storefront with a separate protected admin area. The customer-facing design follows the approved monochrome Gallery direction, with responsive women’s and men’s collections, search, product detail, and a browser-local shopping bag. The images in `public/editorial/` are temporary AI-generated visual concepts. They are not product photographs.

## Run locally

Requires Node.js 24 or a compatible current Next.js runtime.

```bash
npm install
npm run dev
```

Open the Local URL printed by Next.js. Run `npm run typecheck`, `npm run lint`, `npm run build`, and `node --test tests/*.test.mjs` before release. On macOS with Google Chrome installed, `node scripts/visual-check.mjs` checks layout widths and mobile navigation against `http://127.0.0.1:3000`; set `VEGORA_BASE_URL` to point at another local preview.

## Firebase App Hosting preview

The editorial storefront preview is deployed at [vegora--vegoragh.europe-west4.hosted.app](https://vegora--vegoragh.europe-west4.hosted.app/). The `vegora` App Hosting backend is in `europe-west4`; `apphosting.yaml` supplies only public Firebase web identifiers and the project/bucket names. To deploy a reviewed local change to this backend, run `firebase deploy --only apphosting:vegora --project vegoragh`. Source archive rules in `firebase.json` exclude `.env.local`, build output, and dependencies.

This preview is for visual review. Firestore, Firebase Authentication, and the product Storage bucket have not yet been provisioned, so the catalog shows its preparation state and admin sign-in cannot be used. Checkout remains closed.

## Admin and catalog

The admin panel is at `/admin`. The public Firebase web app is linked in `apphosting.yaml`, but Firebase Auth, Firestore, and Storage must be enabled before sign-in, product editing, image uploads, or public catalog data can work. Copy `.env.example` to `.env.local` and fill the values locally. App Hosting uses its managed server identity; local admin development still needs a service account. Follow [ADMIN_SETUP.md](ADMIN_SETUP.md) to configure the Firebase services, deploy deny-all browser rules and indexes, and grant the first operator an admin claim. Do not commit credentials.

Product prices are stored as integer pesewas and displayed in GHS. Draft products remain hidden from the public catalog. No products or prices have been invented for this starter; an operator can add real items through admin once Firebase is configured.

## Checkout status

The shopping bag works locally in the browser. A **test-mode checkout foundation** now calculates totals from Firestore, quotes only configured delivery zones, reserves stock transactionally, initializes Paystack on the server, verifies callbacks and signed webhooks, records payment transitions, and releases unpaid reservations through a scheduled job. The admin can view order details once Firebase services are provisioned. New checkout remains **closed with `503`** until the test key, approved delivery zones, HTTPS callback, public webhook, expiry scheduler, and explicit enable switches are configured. No real or test payment has been processed.

See [ADMIN_SETUP.md](ADMIN_SETUP.md) for the checkout request contract, exact environment gates, webhook and scheduler setup, and test checklist. No server Firebase key or Paystack key has been deployed. The current code rejects live Paystack keys. A live release needs successful test-mode reconciliation plus owner-approved delivery, fulfilment, returns, tax, and customer service rules.

## Visual assets

The SVG wordmark in `src/components/storefront/wordmark.tsx` uses the same shape in black on white and white on black. It is a code-native recreation based on the supplied raster logo. Replace it with the brand’s original vector master if one becomes available. Replace the editorial concepts and add actual product images before launch.
