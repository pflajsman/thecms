# E-shop, Spec 4: Storefront on flajsman.cz

**Date:** 2026-10-01
**Status:** Approved in conversation, awaiting written review
**Scope:** `examples` (the `blog-flajsman` site) only. No backend or admin changes.
**Builds on:** `docs/superpowers/specs/2026-10-01-eshop-catalog-design.md` (catalogue) and `docs/superpowers/specs/2026-10-01-eshop-checkout-orders-design.md` (checkout and orders), both merged and deployed. Spec 3 (invoices) comes later.

## 1. Goal

Customers can buy from flajsman.cz: browse products, pick a variant, keep a cart, check out on one page with shipping and payment choices, place a guest order, and see the order with bank transfer details and a payment QR code. This is for real sales, so the checkout must hold up against price changes, stock running out, double clicks and network failures.

## 2. Decisions

| Topic | Decision |
|---|---|
| Purpose | Real sales on flajsman.cz |
| Placement | Inside the existing site: one deploy, one design system, existing config and API key |
| Language and currency | Czech copy only; product text in the site's `contentLanguage`; the shop's default currency (no currency parameter sent) |
| Cart | Browser only (localStorage), variant ids and quantities, never prices |
| Checkout | One page; the quote refreshes as the customer chooses |
| Terms | A CMS page with key `obchodni-podminky` from the existing pages content type, at `/obchodni-podminky`; checkout always shows and requires the terms checkbox (the public settings endpoint does not expose `termsUrl`, and this shop always has terms) |
| Seller details and legal text | Written by the shop owner in that page; the site only renders it. Not verified here |
| Order button | "Objednat s povinností platby" (wording to be confirmed by the shop owner against consumer law; not verified here) |
| Download links | Only by email, as in spec 2; the order page says they were emailed |
| Tests | Vitest, Testing Library and jsdom added to the example site |

## 3. Pages

| Route | Page |
|---|---|
| `/obchod` | Product grid: first image, name, price ("od 290 Kč" when variants differ), "Vyprodáno" when no variant is available; empty state when the shop has no products |
| `/obchod/:id` | Gallery, rich-text description, a picker per option, price and availability of the chosen variant, quantity (1 to 99, capped by `availableQuantity` when tracked), "Do košíku"; digital products say "Ke stažení po zaplacení" |
| `/kosik` | Lines with quantity controls and Remove, item total, "K pokladně" |
| `/pokladna` | One-page checkout (section 5) |
| `/objednavka/:number?t=<token>` | Order view: the thank-you screen after ordering and the status page later (section 6) |
| `/obchodni-podminky` | The CMS page with key `obchodni-podminky`, rendered like "o mně" |

The header gets an "obchod" link and a cart link showing the item count (with a screen-reader label such as "Košík, 3 položky").

## 4. Cart

- Stored in localStorage under `flajsman.cart.v1` as `[{ variantId, productId, quantity }]`; an unreadable or malformed value starts an empty cart.
- Adding a variant already in the cart raises its quantity; each line is 1 to 99, at most 50 lines (the API's limits).
- Changes in one tab reach the others through the `storage` event.
- Names, prices and problems always come from `POST /public/shop/quote`; nothing priced is stored.
- Line problems from the quote: `NOT_FOR_SALE` or `NO_PRICE` shows "Už není v prodeji" with Remove; `NOT_ENOUGH_STOCK` shows "Skladem jen N ks" with "Snížit na N"; `OUT_OF_STOCK` shows "Vyprodáno" with Remove. Checkout is disabled while any line has a problem.
- The cart is emptied after an order is placed.

## 5. Checkout

Sections, top to bottom:

1. Contact: email, name, phone (optional).
2. Address: country from `GET /public/shop/shipping-countries` (default CZ when listed), street, city, postal code; "Nakupuji na firmu" reveals company and DIČ (`vatId`); "Doručit na jinou adresu" reveals a shipping address (physical carts only). Without it, the shipping address is the billing address.
3. Shipping (physical carts): the quote's `shippingOptions` as radio buttons with price ("zdarma" at 0).
4. Payment: the chosen shipping option's `paymentMethods` with their fee ("Dobírka +39 Kč"); digital-only carts offer bank transfer only.
5. Note for the seller (optional, up to 1000 characters).
6. Summary: lines, items, shipping, payment fee, total, "včetně DPH"; the terms checkbox linking to `/obchodni-podminky`; the order button.

Behaviour:

- The quote is requested again about 300 ms after the country, shipping or payment choice changes; the order sends the last quote's total as `expectedTotal`.
- Each checkout attempt gets an `Idempotency-Key` (random UUID) kept in sessionStorage until the order succeeds, so a double click or a retry after a network failure returns the same order.
- Fields are checked before sending (email format, required fields, terms); errors appear next to the field in Czech and are announced to screen readers.
- Server answers are shown in Czech; the server's English messages are mapped by `reason`, anything unknown gets a generic Czech message:

| Answer | Result |
|---|---|
| `409 PRICE_CHANGED` | The summary switches to the returned quote with "Ceny se mezitím změnily, zkontrolujte souhrn"; the customer must click again |
| `409 OUT_OF_STOCK` | The affected lines are marked, with a link to the cart |
| `400 NO_SHIPPING` / `SHIPPING_REQUIRED` | Message at the shipping section |
| `400 PAYMENT_NOT_ALLOWED` / `PAYMENT_REQUIRED` | Message at the payment section |
| `400 TERMS` | Message at the terms checkbox |
| `422 IDEMPOTENCY_KEY_REUSED` | A new key and "Zkuste to prosím znovu" |
| `429` | "Příliš mnoho pokusů, zkuste to za minutu" |
| Network failure | The form keeps its values; the retry uses the same key |

On success (`201`, or `200` for a replay) the site replaces the checkout in history with `/objednavka/:number?t=<accessToken>` and empties the cart.

## 6. Order page

`GET /public/shop/orders/:number?token=...` shows the number, date, status in Czech, lines, totals and VAT, plus one block by state:

| State | Block |
|---|---|
| Unpaid bank transfer | Account number or IBAN, BIC, amount, variabilní symbol, and the payment QR code drawn from the SPD string with the `qrcode` package; "Platbu spárujeme ručně, potvrzení přijde e-mailem" |
| Cash on delivery, not shipped | "Zaplatíte při převzetí" |
| Paid, with digital lines | "Odkazy ke stažení jsme poslali na váš e-mail" |
| Shipped | Tracking number and link when present |
| Cancelled | "Objednávka byla zrušena" |

A wrong number or token shows "Objednávka nenalezena". The page tells the customer to keep the link.

## 7. Code structure

| Path | Responsibility |
|---|---|
| `src/shop/api.ts` | Typed client for `/public/shop/*` on the existing `request` helper, sending `language` |
| `src/shop/types.ts` | Product, quote and order types matching the public API |
| `src/shop/money.ts` | Minor units to "1 290 Kč" with the currency's decimals |
| `src/shop/cart.tsx` | Cart context, localStorage, tab sync |
| `src/shop/hooks.ts` | React Query hooks for products, product, quote, countries, order |
| `src/shop/errors.ts` | Server reasons to Czech messages |
| `src/shop/pages/*`, `src/shop/components/*` | Pages and parts from sections 3 to 6 |
| `src/styles/global.css` | Shop styles in the blog's style (black and white, lime accent) |

`request` in `src/lib/cms.ts` gains a POST variant (body, extra headers) and returns the error body's `reason` with the message, so checkout can react to it.

## 8. Testing and quality

- Vitest, Testing Library and jsdom in `examples`, with a `test` script; the example site's CI runs it before deploying.
- Tests: cart (add, merge, limits, tab sync, malformed storage); money formatting; checkout against a mocked API (full order, price change, out of stock, no shipping, a double click sending one order with one key, a network failure keeping the form); order page in every state of section 6, including not found.
- Every page works at 360px with no horizontal scroll; form fields have labels; errors are tied to their fields.
- Browser check: a real order through the site against a throwaway database (physical and digital item, bank transfer), the QR code shown, then marked paid and shipped in the admin and the order page updated.

## 9. Delivery

One plan: API client, money and cart; product list and detail; cart page; checkout; order page and terms page; browser check.

## 10. Out of scope

Download links on the order page, the order link in emails (the backend does not know the site's address), countries from an "everywhere else" zone (the countries endpoint lists only named countries), customer accounts, several currencies on the site, discount codes, invoices (spec 3).
