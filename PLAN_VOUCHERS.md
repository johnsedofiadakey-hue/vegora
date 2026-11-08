# Plan: vouchers (percentage discount codes)

Written 8 November 2026 so another agent can continue where this one stops. Tick the boxes as you go and add to the progress log at the end.

## 1. The request

The client wants vouchers. A voucher owner types their voucher number at checkout and gets the percentage discount tied to that voucher. It must be hard to abuse or hack, and the admin must be able to set everything up inside the admin ("settings").

## 2. Decisions (change them if the owner disagrees)

- **Codes are made by the server, never typed in by the admin.** 12 characters from a 32-letter alphabet with no I, L, O or U (60 bits), shown as `XXXX-XXXX-XXXX`. A code like `WELCOME10` could be guessed; a 60-bit random one cannot. The admin gives each voucher a private label (for example "Ama, Instagram giveaway") instead.
- **The percent can never be changed after a voucher is made.** To change it, disable it and make a new one. This stops an edit (or a stolen admin session) quietly turning a 10% voucher into 50%.
- **The percent is capped.** The admin chooses a ceiling in settings (default 30%). The code enforces a hard ceiling of 50% on top, so a mistake or a hijacked admin account cannot create a 100% voucher.
- **Vouchers are off until the admin switches them on** in settings. A master switch also turns every voucher off at once.
- **Discount applies to the clothes only, never delivery.** `discount = floor(clothes × percent ÷ 100)` in pesewas, optionally limited by a per-voucher "most it can take off".
- **One voucher per order. No stacking.**
- **Limits per voucher:** total uses (default 1), uses per phone number (default 1), start date (optional), expiry date (required, at most 400 days ahead), minimum spend (optional), most it can take off (optional), on/off switch.
- **The server decides everything.** The browser only sends the code. Prices, percent, limits and totals are all worked out again on the server inside the same transaction that reserves the stock. The amount sent to Paystack and later checked against Paystack is the discounted total.
- **A use is reserved with the order and given back if the order fails.** Reserved when the order is created (same transaction as stock). Becomes "redeemed" when payment is captured. Given back when the order fails to start, fails, expires, or is moved to review without being captured. The 30-minute reservation window already exists.
- **Uniform failure message.** Unknown, disabled, expired, not started and used-up codes all give the same message ("This voucher cannot be used"), so nobody can learn which codes exist. Specific messages are only for conditions that need a real code (minimum spend, already used with this phone number).
- **Brute-force brakes:** the check endpoint and checkout allow 20 voucher attempts per caller per 10 minutes. With 60-bit codes guessing is not practical anyway. Admin creation is limited to 50 codes per request, 10 requests per minute, and 2,000 vouchers in total.
- **Audit trail.** Every create, change, reserve, redeem and release writes a `voucherEvents` record (code, action, order, who, when).
- **Known limit (say it to the owner):** "once per customer" is by phone number, and a person can use another number. The `total uses` limit and the expiry date are the real protection for a code that gets shared around. Single-use codes (the default) are the strictest.

## 3. Data

- `settings/vouchers`: `{ enabled: boolean (default false), maxPercent: integer 1..50 (default 30), updatedAt, updatedBy }`.
- `vouchers/{code}` (document id is the code without dashes): `code, label, percentOff, maxUses, perCustomerLimit, startsAt|null, expiresAt, minSubtotalMinor, maxDiscountMinor|null, active, reserved, redeemed, createdAt, createdBy, updatedAt`.
- `vouchers/{code}/customers/{phoneKey}`: `{ active: number }` uses that phone number holds (reserved or redeemed).
- `voucherEvents/{auto}`: audit records.
- Orders gain `discountMinor` (0 when none) and `voucher: { code, percentOff, label } | null`. `subtotalMinor` stays the full clothes price; `totalMinor = subtotal − discount + delivery`.
- Firestore rules already deny every client read and write. Only the server touches these.

## 4. Work breakdown

### A. Rules (pure, shared, tested)
- [x] `src/lib/voucher.ts`: constants, `normalizeVoucherCode`, `formatVoucherCode`, `parseVoucherCreate`, `parseVoucherUpdate`, `parseVoucherSettings`, `voucherProblem(voucher, ctx)` (returns a reason or null), `computeDiscount`. No server imports; sibling imports use `.ts`.
- [x] `tests/voucher.test.mjs`.

### B. Server storage and API
- [x] `src/lib/server/vouchers.ts`: settings read (30 s cache) and write, create (random codes), list, update (active, expiry, label, total uses; never percent), delete only if never used.
- [x] Admin routes: `GET/POST /api/admin/vouchers`, `PATCH/DELETE /api/admin/vouchers/[code]`, `GET/PUT /api/admin/voucher-settings`. All `requireAdmin`.
- [x] Public `POST /api/voucher/check` (rate limited, uniform failure, returns percent and the discount for the posted cart).
- [x] `GET /api/checkout/zones` also says whether vouchers are on.

### C. Checkout
- [x] `parseCheckoutInput` accepts an optional `voucherCode`.
- [x] `reserveOrder` validates and reserves the voucher inside the existing transaction (reads before writes), computes the discount, stores it on the order and includes the code in the fingerprint.
- [x] `settleReservation` also redeems (capture) or gives back (release) the voucher use, so every payment path is covered.
- [x] Order total checks still hold (never below the minimum, Paystack gets the discounted total).

### D. Customer screens
- [x] Checkout page: "Have a voucher?" box with Apply and Remove, discount line and new total. Hidden when vouchers are off.
- [x] Track page and public tracking view show the discount line (never the code).

### E. Admin screens
- [x] Sidebar item "Vouchers". Top card: settings (on/off, highest percent allowed). Create form (label, percent, how many codes, total uses, uses per phone, start, expiry, minimum spend, most it can take off). List with search, status (active, used up, expired, off), used / reserved counts, Copy code, turn off/on, extend expiry, delete if unused.
- [x] Orders screen shows the voucher and discount on an order.

### F. Docs and checks
- [x] `ADMIN_SETUP.md` (contract), `OWNER_GUIDE.md` (how to use, the phone-number limit), `CLAUDE_HANDOFF.md`.
- [x] `npm run typecheck`, `npm run lint`, `node --test tests/*.test.mjs`, `npm run build`.
- [x] Emulator end to end (see handoff for the emulator setup): create vouchers, apply at checkout, total and fingerprint, single use cannot be used twice, per-phone limit, expired and disabled codes, release on failure, rate limit, non-admin gets 403.
- [x] Browser check of the checkout box and the admin screen at phone and desktop width.
- [ ] Commit in logical commits. **Do not push or deploy without the owner's go-ahead.** Deploy: `firebase deploy --only apphosting:vegora --project vegoragh`.

## 5. Gotchas

- Firestore transactions need every read before any write. `settleReservation` already reads all products first; add the voucher reads to that same first batch.
- Shared files imported by the node test runner need explicit `.ts` extensions and no server-only imports.
- The Paystack check compares the paid amount with `order.totalMinor`, so the order must store the discounted total.
- A live Paystack key is in use. Do not run any real payment without the owner. The local emulator uses a fake key, so the Paystack step fails there on purpose; the order and voucher reservation still happen first and are released.

## 6. Progress log

- 8 November 2026: plan written.
- 8 November 2026: rules, storage, admin API, checkout hooks, customer box and admin screen built. 9 voucher unit tests; end-to-end run against the emulators (about 90 checks) passed. Browser-checked the admin screen and the checkout box. Not committed or deployed yet.
