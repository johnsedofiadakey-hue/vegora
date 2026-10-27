# VEGORA admin and commerce setup

The storefront can render before services are configured. Catalog APIs return `503` until server Firebase credentials are present. The admin panel is at `/admin`.

## Firebase configuration

Create a Firebase project with Authentication (Email/Password), Firestore, and Cloud Storage. Put the following values in a local `.env.local` and in the deployment's secret/environment settings. Never commit the values.

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

`FIREBASE_PRIVATE_KEY` may contain literal `\\n` sequences; the server converts them to newlines. The client Firebase values identify the project and are public. The service account values are secrets and must remain server-side. Do not use a service account key in browser code.

Deploy `firestore.rules`, `storage.rules`, and `firestore.indexes.json` for the matching project before publishing products. Both rule sets deny direct client access. The Next.js server authenticates each admin request and uses the Admin SDK. Create the first admin user in Firebase Authentication, then run `node scripts/grant-admin.mjs admin@example.com` with the server credentials in your shell environment. Sign out and back in after the claim is set. Only trusted operators should receive this claim.

## Catalog contract

- `GET /api/products?audience=women|men&limit=12` returns `{ products: Product[] }`, published only. Unisex items appear in both collections.
- `GET /api/products?q=term&limit=12` searches published name, category, description, and slug. This initial search supports a catalog smaller than 500 items and fails clearly at that ceiling; add a search index before growing past it.
- `GET /api/products/[slug]` returns `{ product }` for a published item; drafts and archived items return 404.
- `GET/POST /api/admin/products` and `GET/PUT/DELETE /api/admin/products/[slug]` require a Firebase ID token with `admin: true`. DELETE archives the product. Slugs are immutable after creation.
- `POST /api/admin/upload` accepts one JPEG, PNG, WebP, or AVIF file up to 8 MB and returns `{ url }`. Images are served at `/api/media/[assetId]`.
- Prices use integer pesewas (`priceMinor`) and `currency: "GHS"`. A product may stay a draft with no price or image. Publishing requires a price, image, and at least one size variant.

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

The shopper contract is `POST /api/checkout` with `{ email, customer:{name,phone}, delivery:{zoneId,addressLine1,addressLine2?,city,region,notes?}, items:[{slug,variantId,quantity}], idempotencyKey }`. The key must be a random UUID v4. A successful test initialization returns `{ orderId, reference, authorizationUrl }`. `GET /api/checkout/zones` returns approved fee quotes; `GET /api/checkout/verify?reference=...` returns only `{status}`. The admin can read orders at `/admin` and `GET /api/admin/orders`, but there are no fulfillment controls yet.

Before opening test checkout, use synthetic products and orders to verify initialization, successful and failed callbacks, signed webhook delivery, webhook retry/idempotency, amount mismatch handling, reservation expiry, stock reconciliation, and admin order display. Then confirm delivery regions and rates, returns, tax handling, order notifications, and fulfillment ownership before live mode. Live keys are rejected by the current code.

Paystack guidance: [accept payments](https://paystack.com/docs/payments/accept-payments/), [verify payments](https://paystack.com/docs/payments/verify-payments/), [webhooks](https://paystack.com/docs/payments/webhooks/).
