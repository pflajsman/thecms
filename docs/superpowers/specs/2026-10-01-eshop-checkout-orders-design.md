# E-shop, Spec 2: Checkout and Orders

**Date:** 2026-10-01
**Status:** Approved in conversation, awaiting written review
**Scope:** `packages/backend`, `packages/admin-dashboard`. Public API changes are additive. The storefront pages are spec 4.
**Builds on:** `docs/superpowers/specs/2026-10-01-eshop-catalog-design.md` (catalogue, merged and deployed).

## 1. Goal

A site can price a cart, show shipping and payment choices, and place a guest order through the public API. TheCMS reserves stock, sends order emails (with bank transfer instructions and a payment QR code), and lets the shop owner mark orders paid, shipped or cancelled in the admin. Paid digital items get personal download links.

## 2. Decisions

| Topic | Decision |
|---|---|
| Cart | Lives on the site; TheCMS offers a quote endpoint and an order endpoint and stores no carts |
| Stock | Reserved (deducted) when the order is placed; returned when it is cancelled |
| Unpaid bank transfers | Cancelled automatically after N days (default 14), stock returned, customer emailed |
| Bank transfer | Account per currency, order number as payment reference, SPD payment QR code (to confirm with a banking app during testing) |
| Digital delivery | Personal links per paid line, valid 30 days and 5 downloads (both configurable); resend renews them |
| Payment methods | Allowed per shipping method; cash on delivery can carry a fee per currency; never for carts with digital items; digital-only orders pay by bank transfer |
| Customers | Guest checkout; orders carry an optional `customerId` for future accounts |
| Emails | Through the existing Brevo setup, in the order's language (`en` or `cs`, else `en`) |
| VAT on shipping and fees | Taxed at the highest VAT rate among the order's lines (an assumption, not a verified rule: confirm with an accountant before invoices in spec 3) |

## 3. Data model

### 3.1 Shop settings additions (`shopsettings`)

| Field | Rules |
|---|---|
| `bankAccounts` | `[{ currency, accountNumber?, iban?, bic?, holder }]`, at most one per configured currency; at least one of `accountNumber` and `iban`; `holder` 1 to 100 characters |
| `unpaidCancelDays` | Integer 1 to 90, default 14 |
| `downloadDays` | Integer 1 to 365, default 30 |
| `downloadLimit` | Integer 1 to 100, default 5 |
| `shopEmail` | Email for new-order notifications; optional |
| `termsUrl` | `http(s)` URL; when set, checkout requires `acceptTerms: true` |

### 3.2 Shipping zones (new collection `shippingzones`)

| Field | Rules |
|---|---|
| `name` | 1 to 50 characters |
| `countries` | ISO 3166-1 alpha-2 codes, uppercase; a country belongs to at most one zone |
| `rest` | Boolean; at most one zone is "everywhere else" (no countries) |
| `order` | Display order (indexed, used for sorting) |

### 3.3 Shipping methods (new collection `shippingmethods`)

| Field | Rules |
|---|---|
| `labels` | `{ [languageCode]: string }`, default language required |
| `active` | Boolean |
| `paymentMethods` | Non-empty subset of `['BANK_TRANSFER', 'CASH_ON_DELIVERY']` |
| `codFees` | `{ [currency]: minor units }`, used only when cash on delivery is allowed |
| `freeOver` | `{ [currency]: minor units }`, optional free-shipping threshold on the items total |
| `rates` | `[{ zoneId, bands: [{ upToGrams, prices: { [currency]: minor units } }] }]`; bands strictly increasing; the last band may have `upToGrams: null` (no upper limit) |
| `order` | Display order (indexed) |

A method applies to a cart when it is active, a rate exists for the cart's zone, a band covers the cart weight, and the band has a price in the order's currency.

### 3.4 Orders (new collection `orders`)

| Field | Rules |
|---|---|
| `number` | Numeric string, year plus 6-digit counter (for example `2026000001`); unique index (new collection) |
| `accessToken` | Random 32 bytes, URL-safe; never listed in the admin API responses except the order detail |
| `currency`, `language` | From checkout |
| `customer` | `{ email, name, phone? }` |
| `customerId` | Optional, unused until accounts exist |
| `billingAddress` | `{ name, company?, street, city, postalCode, country, vatId? }` |
| `shippingAddress` | Same shape; required when any line is physical |
| `note` | Up to 1000 characters |
| `lines` | `[{ productId, variantId, itemId, sku, name, optionLabels: [{ option, value }], type, unitPrice, quantity, vatRate, lineTotal, weightGrams }]`, a snapshot in the order's language |
| `shipping` | `{ methodId, name, price }` or null for digital-only orders |
| `payment` | `{ method, fee, reference }` (`reference` = `number` for bank transfer) |
| `totals` | `{ items, shipping, paymentFee, total, vat: [{ rate, base, amount }] }`, all minor units; VAT is included in prices, `amount = round(gross × rate / (10000 + rate))` per rate on the gross sum of lines (plus shipping and fee at the highest line rate) |
| `status` | `PLACED`, `COMPLETED`, `CANCELLED` |
| `paymentStatus` | `UNPAID`, `PAID`, `REFUNDED` |
| `fulfilmentStatus` | `UNFULFILLED`, `SHIPPED`; digital-only orders are `SHIPPED` once paid |
| `tracking` | `{ number?, url? }` |
| `internalNote` | Admin only |
| `history` | `[{ at, type, by?, detail? }]` for status changes, emails sent or failed, resends |
| `idempotencyKey` | Optional, indexed, unique per site key; retries return the first order |
| `createdAt`, `updatedAt` | Indexed for list sorts |

Rules: an order is `COMPLETED` when it is paid and shipped. Cancelling returns stock for every line and moves `status` to `CANCELLED`; a paid order asks whether to mark it `REFUNDED`.

### 3.5 Counters (new collection `counters`)

`{ _id: 'order-2026', value }` incremented with `findOneAndUpdate($inc, upsert)`; the year comes from the order time in UTC.

### 3.6 Download grants (new collection `downloadgrants`)

`{ token (unique), orderId, lineIndex, productId, expiresAt, limit, used }`. Created when a digital line is paid; a resend creates fresh grants and expires the old ones.

## 4. Pricing rules (quote and order share one function)

1. Lines: each variant must be for sale in the currency (catalogue spec 4.5) and have enough stock when tracked; problems are reported per line.
2. Items total = sum of `unitPrice × quantity`.
3. Weight = sum of physical line weights.
4. Shipping: the cart's zone from the shipping country (its zone, else the "rest" zone); methods that apply (3.3); price = band price, or 0 when `freeOver[currency]` is set and the items total reaches it.
5. Payment fee: cash on delivery fee of the chosen method in the currency; 0 for bank transfer.
6. Cash on delivery is never offered when the cart has a digital line; digital-only carts have no shipping and only bank transfer.
7. Total = items + shipping + fee.

## 5. Public API (additive, site API key)

| Endpoint | Behaviour |
|---|---|
| `POST /public/shop/quote` | Body `{ currency?, language?, items: [{ variantId, quantity }], country?, shippingMethodId?, paymentMethod? }` (1 to 50 items, quantity 1 to 99). Returns lines with names and option labels in the language, problems, shipping options for the country with prices and allowed payment methods and fees, and totals with VAT per rate |
| `POST /public/shop/orders` | The quote fields plus `customer`, `billingAddress`, `shippingAddress?`, `note?`, `acceptTerms?`, `expectedTotal`. Re-prices; `409 { reason: 'PRICE_CHANGED', quote }` when the total differs; reserves stock per line with a conditional update and undoes earlier reservations if one fails (`409 { reason: 'OUT_OF_STOCK', lines }`); creates the order; sends emails; fires `order.placed`. Optional `Idempotency-Key` header. Returns `{ number, accessToken, total, currency, payment: { method, instructions? } }` |
| `GET /public/shop/orders/:number?token=` | Order status, lines, totals and payment instructions for the thank-you page; `404` for a wrong token |
| `GET /public/shop/downloads/:token` | Checks expiry and limit, increments `used`, redirects (302) to a private blob SAS URL valid 5 minutes; `410` when expired or used up |
| `GET /public/shop/shipping-countries` | Countries that have a zone (for the checkout country select) |

Payment instructions for bank transfer: `{ holder, accountNumber?, iban?, bic?, amount, currency, reference, qr }` where `qr` is the SPD string (`SPD*1.0*ACC:<IBAN>*AM:<amount>*CC:<currency>*X-VS:<reference>*MSG:<shop name and number>`). SPD identifies the account by IBAN only, so `qr` is present only when the currency's bank account has an IBAN; Shop settings show a hint when it is missing.

Rate limits: quote like the public API; orders 10 per minute per site key and IP.

## 6. Payment provider interface

```ts
interface PaymentProvider {
  method: 'BANK_TRANSFER' | 'CASH_ON_DELIVERY'
  instructions(order, settings): PaymentInstructions | undefined
  onPaid?(order): Promise<void>
}
```

Bank transfer and cash on delivery are the two implementations; card payments plug in later behind the same interface.

## 7. Background job

Hourly (in-process timer started after the database connects): find `PLACED`, `UNPAID`, bank transfer orders older than `unpaidCancelDays`; cancel each with a conditional update (`status: 'PLACED', paymentStatus: 'UNPAID'`) so several backend instances never cancel twice; return stock; email the customer; fire `order.cancelled`.

## 8. Emails

| Email | To | When |
|---|---|---|
| Order confirmation | Customer | Order placed; includes lines, totals, shipping, payment instructions and the QR code as a PNG attachment |
| New order | `shopEmail` | Order placed |
| Payment received | Customer | Marked paid; includes download links for digital lines |
| Shipped | Customer | Marked shipped; tracking when given |
| Cancelled | Customer | Cancelled by the admin or the job |

Templates live in the backend in English and Czech. Sending never blocks the order; failures are recorded in `history` as "email not sent" with the reason.

## 9. Admin

- **Commerce → Orders**: list with number, date, customer, total, payment, shipping and order status; search by number or email; filters; navigation badge for orders that need action (paid and unshipped, or cash on delivery unshipped).
- **Order page**: lines, totals, customer, addresses, payment instructions, tracking, history, internal note; actions Mark as paid, Mark as shipped (tracking number and URL), Cancel (with "mark as refunded" when paid), Resend confirmation, Resend downloads.
- **Commerce → Shipping**: zones (name, countries) and methods (labels per language, zones with weight bands and prices per currency, free threshold, payment methods, cash on delivery fee, active).
- **Shop settings**: bank accounts, unpaid cancel days, download days and limit, shop email, terms link.

All new UI text in English and Czech under the lint guard; prices with the currency's decimals in the admin language.

## 10. Webhooks

`order.placed`, `order.paid`, `order.shipped`, `order.cancelled` with `{ order: { id, number, status, paymentStatus, fulfilmentStatus, total, currency } }`.

## 11. Error handling

- Quote and order validation: `400` with the field.
- Unknown currency or language: `400` as in the catalogue API.
- Price change between quote and order: `409 PRICE_CHANGED` with a fresh quote.
- Stock gone at order time: `409 OUT_OF_STOCK` with the lines; no stock is held.
- Shipping country without a zone, or no method applies: `400 NO_SHIPPING`.
- Terms not accepted when `termsUrl` is set: `400`.
- Admin actions in the wrong state (ship a cancelled order, pay twice): `409`.

## 12. Testing

- Backend (Jest, in-memory MongoDB): pricing (bands, free threshold, cash on delivery fee, VAT per rate and rounding); quote problems; price change at order time; two concurrent orders for the last item (one wins, stock never negative); idempotency key; order numbers unique and sequential under concurrency; state machine and `409`s; cancel returns stock; job cancels once with two runners; download expiry and limit; SPD string; emails sent and failures recorded; webhooks; Cosmos sort test for every new list.
- Admin (Vitest): Shipping editor, settings additions, Orders list and filters, order actions; English and Czech; axe.
- Browser: a CZ order with a physical and a digital item paid by bank transfer, marked paid (download email), shipped; QR code scanned with a banking app.

## 13. Delivery

1. Backend: settings additions, shipping, pricing, quote and orders, stock reservation, payment providers and QR, emails, downloads, job, webhooks.
2. Admin: Shipping, settings additions, Orders list and order page, browser verification.

## 14. Out of scope

Customer accounts, card payments, automatic bank matching, invoices (spec 3), storefront pages (spec 4), discounts, partial shipments and refunds of single lines, returns, pickup points.
