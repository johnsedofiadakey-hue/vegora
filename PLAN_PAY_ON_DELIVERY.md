# Plan: pay on delivery (cash or mobile money to the rider)

Written 16 November 2026 so another agent can continue where this one stops. Tick the boxes as you go and add to the progress log at the end.

## 1. The request

Let a customer choose to pay when the order arrives, instead of paying online with Paystack. It must work well inside the existing system: stock, vouchers, tracking, the admin and the reports.

## 2. The hard part, and how this plan handles it

Paystack orders are paid before anything is packed. A pay-on-delivery order is not, and the shop has **no email or SMS** to check who is ordering. So the risk is fake orders that hold stock and waste a delivery trip. The controls:

- **Off until the owner switches it on**, and only in the areas he ticks (his own riders, his own areas).
- **A call confirms every order.** A new pay-on-delivery order waits in the admin as "Confirm by phone". Nothing is packed or sent until the admin has spoken to the customer and pressed **Confirm order**.
- **Unconfirmed orders do not hold stock for long.** After 48 hours without confirmation the order expires and the stock goes back on sale (the existing expiry job does it).
- **A cap on the order value** (owner sets it, default GH₵500, never above GH₵2,000), checked on the server.
- **At most 2 open pay-on-delivery orders per phone number** at a time, and a tighter rate limit per caller.
- **Cash is recorded when it is handed over.** The admin can only mark an order Delivered by confirming the money was received; that is the moment the order becomes Paid, stock is taken off for good, and a voucher use is counted.
- **Cancel** releases the stock and the voucher use.

## 3. Decisions (change them if the owner disagrees)

- A new payment status `pay_on_delivery` (stock is **reserved**, not taken off) and `cancelled`. `paid` still means "money received". The order records `paymentMethod`: `paystack` (old orders and default) or `cash_on_delivery`.
- Confirmation is a field on the order (`codConfirmedAt`), not another status. Delivery steps (Preparing, Dispatched, Delivered) unlock only after confirmation.
- The Delivered step on a pay-on-delivery order must carry `cashReceived: true`. The server then, in one transaction, sets the order Paid (`paymentStatus: cash_collected`), takes the stock off and redeems any voucher.
- Cancelling is allowed until delivered. A delivered order cannot be cancelled (same rule as before: Delivered is final).
- Settings live with the delivery areas, in `settings/delivery`: `cod: { enabled, maxOrderMinor }`, and each area has `cod: true|false`. The Delivery admin screen edits all of it.
- The customer still pays the same total: clothes minus voucher plus delivery. Vouchers work with pay on delivery.
- Paystack is never called for a pay-on-delivery order, and a stray Paystack message about one is ignored.
- Known limit (say it to the owner): the phone call is the only check on who ordered. A determined prankster can still waste a call. Unconfirmed orders expire, so the damage is small.

## 4. Data

- Order: `paymentMethod`, `codConfirmedAt`, `codConfirmedBy`, `cancelledAt`, `cancelReason`. `status` gains `pay_on_delivery` and `cancelled`.
- `settings/delivery.cod`: `{ enabled: boolean (default false), maxOrderMinor: integer, default 50000, never above 200000 }`. Each area gets `cod: boolean` (default false).
- Audit: `paymentEvents` already records every status change; confirm, cancel and cash received write there too.

## 5. Work breakdown

### A. Rules (pure, tested)
- [x] `src/lib/delivery.ts`: area `cod` flag, `CodSettings`, parser, limits.
- [x] `src/lib/payment-method.ts`: `codAvailable(...)`, `deliveryUnlocked(order)`, hold time.
- [x] `src/lib/fulfillment.ts`: transitions unlock for confirmed pay-on-delivery orders; tracking view shows the method and amount due.
- [x] Tests.

### B. Server
- [x] `delivery-settings.ts` and `checkout-config.ts` carry the cod settings and area flag.
- [x] `reserveOrder` takes a payment method, checks the rules, holds the stock for 48 hours, limits open orders per phone.
- [x] `POST /api/checkout` skips Paystack for pay on delivery.
- [x] `confirmCodOrder`, `cancelOrder`, and cash-received handling inside `updateOrderFulfillment`.
- [x] `payment-policy.ts` and `reconcilePayment` ignore pay-on-delivery orders; `expireReservations` expires unconfirmed ones.
- [x] Admin routes for confirm and cancel.

### C. Customer screens
- [x] Checkout: "How do you want to pay?" shown only where allowed; button text and a short notice change.
- [x] After ordering: confirmation page with the order number card and "we will call you".
- [x] Track page: confirmation, amount to pay on delivery, cancelled.

### D. Admin
- [x] Delivery screen: Pay on delivery card (switch, highest order amount) and a tick per area.
- [x] Orders: "Confirm by phone" badge and count, Confirm and Cancel buttons, cash-received tick on Delivered, method and amount shown.
- [x] Insights: cash still to collect.

### E. Docs and checks
- [x] `ADMIN_SETUP.md`, `OWNER_GUIDE.md`, the admin guide PDF, `CLAUDE_HANDOFF.md`.
- [x] `npm run typecheck`, `npm run lint`, tests, build, emulator end to end, browser check.
- [x] Commit (not pushed). **Do not push or deploy without the owner's go-ahead.**

## 6. Progress log

- 16 November 2026: plan written.
- 16 November 2026: rules, server, checkout, admin screens, customer screens and Insights line built. 9 new unit tests and an end-to-end run against the emulators (58 checks, including vouchers, expiry, cancel and cash received) passed. Checked in the browser (checkout choice, confirmation page, Track page, Orders, Delivery). Not committed or deployed yet.
