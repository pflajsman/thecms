# E-shop, Spec 1: Catalogue

**Date:** 2026-10-01
**Status:** Approved in conversation, awaiting written review
**Scope:** `packages/backend`, `packages/admin-dashboard`. Public API changes are additive.

## 1. Goal

TheCMS can hold a product catalogue: physical and digital products with variants, stock, prices in several currencies and a VAT rate, managed in a new Commerce section of the admin and readable by sites through the public API. Product text (name, description, images) lives in a linked content entry, so it gets content languages, the editor and media for free.

## 2. The e-shop roadmap

| Spec | Contents |
|---|---|
| **1. Catalogue (this spec)** | Shop settings (currencies, VAT rates), products, variants, stock, private digital files, Commerce admin, read-only public shop API |
| 2. Checkout and orders | Cart pricing, shipping zones and weight-based rates, payment methods (bank transfer, cash on delivery) behind a provider interface, guest checkout, orders with separate payment and fulfilment status, line snapshots, stock deduction, order emails, download links for digital items after payment |
| 3. Invoices | Invoice numbering, seller details, VAT breakdown, PDF |
| 4. Storefront | Shop pages in the example site |

Later: customer accounts (orders are shaped for them in spec 2), online card payments, pickup-point carriers.

## 3. Decisions

| Topic | Decision |
|---|---|
| What is sold | Physical and digital goods |
| Products | A typed commerce record linked to a content entry of a fixed "Product" model (text and images); checkout reads only the commerce record |
| Variants | Options (for example Size, Colour); one variant per combination with its own SKU, stock, weight and prices |
| Currencies | Several; each variant has an explicit price per currency (no conversion); the site chooses the currency |
| Money | Integer minor units (490.00 CZK is stored as 49000) |
| VAT | One rate per product from the seller's own rates; prices are entered including VAT |
| Digital files | Private blob container; download links come in spec 2 |
| Categories | Not a commerce feature: a content model and relation fields do it |

## 4. Data model

### 4.1 Shop settings (new collection `shopsettings`, one document)

| Field | Rules |
|---|---|
| `currencies` | `[{ code, decimals }]`, code is ISO 4217 style (`^[A-Z]{3}$`), decimals 0 to 3, codes unique |
| `defaultCurrency` | One of `currencies` |
| `vatRates` | `[{ id, name, rate }]`, `rate` in basis points (2100 = 21 %), 0 to 10000; `name` 1 to 50 characters |

- A currency cannot be removed while any variant has a price in it; the default currency cannot be removed.
- A VAT rate cannot be removed while a product uses it.
- Products cannot be created until at least one currency and one VAT rate exist.

### 4.2 Products (new collection `products`)

| Field | Rules |
|---|---|
| `itemId` | Item id of the linked content entry (every language version belongs to it); unique |
| `type` | `PHYSICAL` or `DIGITAL` |
| `vatRateId` | One of the settings' VAT rates |
| `active` | Boolean, default `false` |
| `options` | `[{ key, labels: { [languageCode]: string }, values: [{ key, labels }] }]`; keys match `^[a-z][a-z0-9-]{0,39}$`, unique within their list; a label in the default language is required; at most 3 options with 50 values each |
| `digitalFile` | `DIGITAL` only: `{ blobName, originalName, mimeType, size }` in the private container; absent until uploaded |
| `createdAt`, `updatedAt`, `createdBy`, `updatedBy` | As other collections |

### 4.3 Variants (new collection `variants`)

| Field | Rules |
|---|---|
| `productId` | Indexed |
| `sku` | 1 to 64 characters, unique across the shop (unique index; the collection is new) |
| `optionValues` | `{ [optionKey]: valueKey }`, one value per product option; unique combination per product |
| `prices` | `{ [currencyCode]: integer >= 0 }` in minor units |
| `weightGrams` | Integer >= 0, `PHYSICAL` only |
| `stock` | `{ tracked: boolean, quantity: integer >= 0 }`; `DIGITAL` variants are never tracked |
| `active` | Boolean, default `true` |

Variants live in their own collection so SKUs are unique by index and spec 2 can reduce stock atomically (`findOneAndUpdate` with `quantity >= n`).

### 4.4 The Product content model

- Created automatically at startup if missing (idempotent, next to the content languages migration): slug `product`, name "Product", fields `name` (TEXT, required, translated, title field), `description` (RICH_TEXT, translated), `images` (MEDIA, multiple, shared).
- Marked `system: 'product'`: it cannot be deleted, and its three core fields cannot be removed, renamed or have their type changed. Editors can add fields.
- A product entry's last remaining version cannot be deleted from the content API (`409` "This entry belongs to a product; delete it under Commerce"); deleting one of several language versions is allowed.

### 4.5 When a product is for sale

A variant is for sale in currency `C` when all hold:

1. The product is `active`.
2. The variant is `active`.
3. The linked entry has a published version (in any language; content fallback applies).
4. The variant has a price in `C`.
5. Stock is not tracked, or its quantity is above zero (`available: false` otherwise, see 6.2).

A product is listed when at least one variant passes 1 to 4.

## 5. Admin

### 5.1 Navigation

A new **Commerce** group with **Products** and **Settings**. Spec 2 adds Orders and Shipping. The module registry gets the group `commerce`.

### 5.2 Commerce → Settings

- Currencies: add (code, decimals), mark default, remove (blocked with the reason while in use).
- VAT rates: add (name, rate in percent with up to two decimals), rename, remove (blocked while in use).
- Without a currency or a VAT rate, Products shows a setup prompt that links here.

### 5.3 Products list

- Columns: name (the entry title in the default language, else any version), type, variants count, price range in the default currency, stock ("Out of stock", "Low" when a tracked variant has 5 or fewer, else nothing), status ("Active", "Inactive", "Not published" when the entry has no published version).
- Search by name or SKU; filter by type and status; pager; single-field sorts only (Cosmos DB rule).

### 5.4 New product

A dialog asks for name and type. It creates the content entry (draft, default language, `name` set), the product (inactive) and one variant (SKU generated from the name, editable), then opens the product.

### 5.5 Product page

Two tabs:

- **Content:** the existing entry editor for the linked entry, including the language switcher, Translate and shared-field hints.
- **Selling:**
  - Type (fixed after creation), VAT rate, Active.
  - Options editor: option and value labels, one input per content language (the default language required).
  - Variants table: SKU, a price per currency, weight (physical), stock tracked and quantity, Active. "Set for all" fills one column for every variant.
  - Changing options adds missing combinations (prices copied from the first variant, stock 0) and lists combinations that no longer exist; they are removed after confirming.
  - Digital file (digital only): upload (up to 500 MB), replace, name and size shown; the file is never shown as a public link.
  - Delete product: removes the product, its variants, its file and every version of its entry, after typing the product name.

All new text is in English and Czech under the lint guard. Prices show the currency's decimals in the admin language's number format.

## 6. Public API (additive, API key like the content API)

### 6.1 `GET /public/shop/settings`

`{ currencies: [{ code, decimals }], defaultCurrency }`.

### 6.2 `GET /public/shop/products`

Query: `currency`, `language`, `page`, `limit` (max 100), `ids` (comma-separated product or entry ids). Missing `currency` or `language` means the defaults; unknown codes return `400` listing the valid ones.

Each item:

```json
{
  "id": "…",
  "type": "PHYSICAL",
  "itemId": "…",
  "content": { "…entry JSON…": "", "language": "cs", "fallback": false },
  "options": [{ "key": "size", "label": "Velikost", "values": [{ "key": "m", "label": "M" }] }],
  "variants": [{ "id": "…", "sku": "TEE-M", "optionValues": { "size": "m" }, "price": 49000, "vatRate": 2100, "available": true, "availableQuantity": 3 }],
  "priceRange": { "min": 49000, "max": 49000 },
  "currency": "CZK"
}
```

- `content` follows the content API fallback (requested language, else default language; published versions only).
- Labels use the requested language, else the default language.
- Only variants for sale (4.5, rules 1 to 4) are listed; `available` is false when tracked stock is 0; `availableQuantity` is null when stock is not tracked.
- Sorted by the product's `createdAt`, newest first (single-field index on `products`); totals count products. Sites that need another order use `ids=`.

### 6.3 `GET /public/shop/products/:id`

One product by product id or entry (item or version) id; `404` when not for sale.

### 6.4 Webhooks

New events: `product.updated` (product or its variants changed), `product.deleted`, `stock.changed` (a quantity changed in the admin). Payloads carry the product id, item id and changed variant ids.

## 7. Error handling

- Duplicate SKU: `409` with the SKU; the variants table marks the row.
- Removing a currency, VAT rate, option or option value in use: `409` with the reason.
- Upload over 500 MB or to a physical product: `400`.
- Creating a product before settings exist: `409` "Add a currency and a VAT rate first".
- Product entry deletions guarded as in 4.4.

## 8. Testing

- Backend (Jest, in-memory MongoDB): settings rules; product create and delete keep product, variants, file and entry together; unique SKU; option changes and variant regeneration; for-sale rules including a missing price in the requested currency and an unpublished entry; content and label language fallback; `400` for unknown currency or language; the product model guard; webhooks; the Cosmos sort test extended to every new list.
- Admin (Vitest): settings, products list, new product, Selling tab (options, regeneration, Set for all, duplicate SKU), digital upload, delete; English and Czech; axe.
- Browser: on a copy of local data, create a T-shirt with two sizes priced in CZK and EUR, publish its entry, read it through the public API with and without `currency` and `language`.

## 9. Delivery

1. Backend: settings, products, variants, product model, private file storage, public shop API, webhooks.
2. Admin: Commerce group, Settings, Products list, product page with Selling tab, browser verification.

## 10. Out of scope (later specs)

Cart, checkout, orders, shipping, payments, stock deduction and reservations, invoices, the storefront, customer accounts, discounts and coupons, product reviews, bulk import.
