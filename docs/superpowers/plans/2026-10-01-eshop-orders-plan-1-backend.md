# E-shop Checkout and Orders, Plan 1: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sites can quote a cart and place guest orders through the public API; TheCMS reserves stock, numbers and stores orders, sends order emails with bank transfer instructions and an SPD QR code, issues download links for paid digital lines, cancels stale unpaid transfers, and gives the admin API order actions.

**Architecture:** One pure pricing function (`priceCart`) computes lines, shipping options, fees and totals from a loaded context, so quote and order cannot disagree. Orders reserve stock with conditional `findOneAndUpdate` per variant and undo on failure. Payment methods implement a small `PaymentProvider` interface. Status changes go through one `OrderActions` module that records history, sends emails and fires webhooks.

**Tech Stack:** Express, Mongoose 6, Zod, Jest, mongodb-memory-server, supertest, @azure/storage-blob (SAS), @getbrevo/brevo, `qrcode` (new dependency).

**Spec:** `docs/superpowers/specs/2026-10-01-eshop-checkout-orders-design.md`

**Series:** Plan 1 of 2. Plan 2 covers the admin screens.

## Global Constraints

- Money is integer minor units everywhere; VAT is included in prices; VAT amount per rate is `round(gross * rate / (10000 + rate))`.
- Shipping and payment fees are taxed at the highest VAT rate among the order's lines (spec Decisions; assumption to confirm with an accountant).
- Cash on delivery is never offered for a cart with a digital line; digital-only carts have no shipping and only bank transfer.
- Order numbers: year plus 6-digit counter (`2026000001`), unique.
- Every `find` sort is served by a single-field index (Cosmos DB); unique indexes only on new, empty collections.
- Public API changes are additive; errors use `AppError` and `{ success: false, error }`; 409 bodies add `reason` and data.
- Emails never block an order or an admin action; failures are recorded in the order history.
- Never use an em dash in code comments or docs.

## Decisions (for the reviewer)

1. **Stock reservation without transactions.** Cosmos DB for MongoDB transactions have limits we do not rely on; each tracked variant is decremented with `findOneAndUpdate({ _id, 'stock.quantity': { $gte: n } }, { $inc: -n })` and earlier reservations are undone if a later one fails. A crash between reserving and saving the order can lose stock until an admin corrects it; the order insert happens right after reserving to keep that window small.
2. **The job runs in-process** with `setInterval` (hourly) and a conditional update per order, so several backend instances are safe. No scheduler service is added.
3. **Templates are plain TypeScript functions** with an `en`/`cs` string table in the backend, not a template engine.
4. **SAS links** for downloads use the storage account key from the connection string (`generateSasUrl` on the blob client), 5 minutes, read only.

## Review Focus

1. **Two customers order the last unit at the same moment**: exactly one order is created, stock ends at 0, never negative; the other gets `409 OUT_OF_STOCK` and no stock is held. Tested in Task 4.
2. **A price or shipping rate changes between quote and order**: `409 PRICE_CHANGED` with a fresh quote; nothing reserved. Tested in Task 4.
3. **The same order request is retried (double click, network retry) with the same Idempotency-Key**: one order, same number returned. Tested in Task 4.
4. **Two backend instances run the auto-cancel job at the same time**: each stale order is cancelled once, stock returned once, one email. Tested in Task 7.
5. **Brevo is not configured or fails**: the order is placed and the history shows "email not sent" with the reason. Tested in Task 6.

---

## File Structure

All paths relative to `packages/backend/src`.

| File | Responsibility |
|---|---|
| `models/shop-settings.model.ts` | New fields (bank accounts, days, limits, shop email, terms URL) |
| `models/shipping.model.ts` | `ShippingZoneModel`, `ShippingMethodModel` |
| `models/order.model.ts`, `models/counter.model.ts`, `models/download-grant.model.ts` | Orders, counters, grants |
| `modules/commerce/shipping.service.ts` | Zones and methods CRUD with validation |
| `modules/commerce/pricing.ts` | `priceCart(input, context)`: pure |
| `modules/commerce/pricing-context.ts` | `loadPricingContext(input)` from the database |
| `modules/commerce/payments.ts` | `PaymentProvider`, bank transfer, cash on delivery, `spdString` |
| `modules/commerce/orders.service.ts` | `placeOrder`, `nextOrderNumber`, stock reserve/release, public order view |
| `modules/commerce/order-actions.ts` | markPaid, markShipped, cancel, resend; history; webhooks |
| `modules/commerce/downloads.service.ts` | Grants and SAS redirect |
| `modules/commerce/order-emails.ts`, `modules/commerce/email-strings.ts` | Templates and strings |
| `modules/commerce/unpaid-job.ts` | Auto-cancel job |
| `services/email.service.ts` | Generic `send({ to, subject, html, attachments })` |
| `modules/commerce/commerce.*`, `modules/public/public.*` | Routes |

---

## Task 1: Settings additions and shipping

**Files:**
- Create: `models/shipping.model.ts`, `modules/commerce/shipping.service.ts`, `modules/commerce/shipping.test.ts`
- Modify: `models/shop-settings.model.ts`, `modules/commerce/commerce.schema.ts`, `modules/commerce/settings.service.ts` (keep new fields on replace), `commerce.controller.ts`, `commerce.routes.ts`
- Test: `modules/commerce/settings.test.ts` (add)

**Interfaces:**
- Produces:
  - Settings fields `bankAccounts: { currency; accountNumber?; iban?; bic?; holder }[]`, `unpaidCancelDays` (14), `downloadDays` (30), `downloadLimit` (5), `shopEmail?`, `termsUrl?`; `SettingsService.get()` returns defaults when absent.
  - `ShippingZoneModel { name; countries: string[]; rest: boolean; order }`, `ShippingMethodModel { labels; active; paymentMethods: PaymentMethod[]; codFees; freeOver; rates: { zoneId; bands: { upToGrams: number | null; prices }[] }[]; order }`, `type PaymentMethod = 'BANK_TRANSFER' | 'CASH_ON_DELIVERY'`
  - `ShippingService.listZones/saveZone/deleteZone/listMethods/saveMethod/deleteMethod`
  - Routes: `GET/POST /commerce/shipping/zones`, `PUT/DELETE /commerce/shipping/zones/:id`, same for `/commerce/shipping/methods`

- [ ] **Step 1: Write the failing tests**

`modules/commerce/shipping.test.ts`:

```ts
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { LanguageModel } from '../../models/language.model';
import { SettingsService } from './settings.service';
import commerceRoutes from './commerce.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/commerce', commerceRoutes);
app.use(errorMiddleware);

beforeEach(async () => {
  await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
  await SettingsService.replace({ currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }] });
});

it('stores zones and refuses a country in two zones or two "rest" zones', async () => {
  const cz = await request(app).post('/commerce/shipping/zones').send({ name: 'Czechia', countries: ['cz'] });
  expect(cz.status).toBe(201);
  expect(cz.body.data.countries).toEqual(['CZ']);
  expect((await request(app).post('/commerce/shipping/zones').send({ name: 'Again', countries: ['CZ', 'SK'] })).status).toBe(409);
  expect((await request(app).post('/commerce/shipping/zones').send({ name: 'Rest', countries: [], rest: true })).status).toBe(201);
  expect((await request(app).post('/commerce/shipping/zones').send({ name: 'Rest 2', countries: [], rest: true })).status).toBe(409);
  expect((await request(app).post('/commerce/shipping/zones').send({ name: 'Bad', countries: ['CZE'] })).status).toBe(400);
});

it('stores a method with increasing weight bands and validates currencies and payment methods', async () => {
  const zone = (await request(app).post('/commerce/shipping/zones').send({ name: 'Czechia', countries: ['CZ'] })).body.data;
  const method = {
    labels: { en: 'Courier' },
    active: true,
    paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'],
    codFees: { CZK: 3900 },
    freeOver: { CZK: 200000 },
    rates: [{ zoneId: zone.id, bands: [{ upToGrams: 2000, prices: { CZK: 12900 } }, { upToGrams: null, prices: { CZK: 19900 } }] }],
  };
  const saved = await request(app).post('/commerce/shipping/methods').send(method);
  expect(saved.status).toBe(201);
  expect(saved.body.data).toMatchObject({ labels: { en: 'Courier' }, codFees: { CZK: 3900 } });
  const bad = [
    { ...method, rates: [{ zoneId: zone.id, bands: [{ upToGrams: 2000, prices: { CZK: 1 } }, { upToGrams: 1000, prices: { CZK: 2 } }] }] },
    { ...method, rates: [{ zoneId: zone.id, bands: [{ upToGrams: null, prices: { CZK: 1 } }, { upToGrams: 5000, prices: { CZK: 2 } }] }] },
    { ...method, codFees: { USD: 100 } },
    { ...method, paymentMethods: [] },
    { ...method, labels: { cs: 'Kurýr' } },
    { ...method, rates: [{ zoneId: '507f1f77bcf86cd799439011', bands: [{ upToGrams: null, prices: { CZK: 1 } }] }] },
  ];
  for (const body of bad) expect((await request(app).post('/commerce/shipping/methods').send(body)).status).toBe(400);
});

it('refuses to delete a zone that a method uses', async () => {
  const zone = (await request(app).post('/commerce/shipping/zones').send({ name: 'Czechia', countries: ['CZ'] })).body.data;
  await request(app).post('/commerce/shipping/methods').send({ labels: { en: 'Post' }, active: true, paymentMethods: ['BANK_TRANSFER'], rates: [{ zoneId: zone.id, bands: [{ upToGrams: null, prices: { CZK: 9900 } }] }] });
  expect((await request(app).delete(`/commerce/shipping/zones/${zone.id}`)).status).toBe(409);
});
```

Add to `settings.test.ts`:

```ts
it('stores bank accounts, days, limits, shop email and terms link with defaults', async () => {
  const empty = (await request(app).get('/commerce/settings')).body.data;
  expect(empty).toMatchObject({ unpaidCancelDays: 14, downloadDays: 30, downloadLimit: 5, bankAccounts: [] });
  const body = {
    ...settings,
    bankAccounts: [{ currency: 'CZK', accountNumber: '123456789/0800', iban: 'CZ6508000000192000145399', holder: 'Pavel F.' }],
    unpaidCancelDays: 10,
    shopEmail: 'shop@example.test',
    termsUrl: 'https://example.test/terms',
  };
  const saved = await request(app).put('/commerce/settings').send(body);
  expect(saved.body.data).toMatchObject({ unpaidCancelDays: 10, downloadDays: 30, bankAccounts: [{ currency: 'CZK', holder: 'Pavel F.' }] });
  expect((await request(app).put('/commerce/settings').send({ ...body, bankAccounts: [{ currency: 'USD', iban: 'X', holder: 'A' }] })).status).toBe(400);
  expect((await request(app).put('/commerce/settings').send({ ...body, bankAccounts: [{ currency: 'CZK', holder: 'A' }] })).status).toBe(400);
  expect((await request(app).put('/commerce/settings').send({ ...body, termsUrl: 'ftp://x' })).status).toBe(400);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- shipping.test settings.test`
Expected: FAIL: 404 on shipping routes; defaults missing.

- [ ] **Step 3: Implement**

`shop-settings.model.ts` additions:

```ts
    bankAccounts: [{ _id: false, currency: String, accountNumber: String, iban: String, bic: String, holder: String }],
    unpaidCancelDays: { type: Number, default: 14 },
    downloadDays: { type: Number, default: 30 },
    downloadLimit: { type: Number, default: 5 },
    shopEmail: { type: String },
    termsUrl: { type: String },
```

and the interface fields. `settingsBody` in `commerce.schema.ts`:

```ts
const bankAccount = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    accountNumber: z.string().trim().max(40).optional(),
    iban: z.string().trim().toUpperCase().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/).optional(),
    bic: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/).optional(),
    holder: z.string().trim().min(1).max(100),
  })
  .refine((a) => a.accountNumber || a.iban, { message: 'Add an account number or an IBAN' });

// in the settings object:
    bankAccounts: z.array(bankAccount).max(20).default([]),
    unpaidCancelDays: z.number().int().min(1).max(90).default(14),
    downloadDays: z.number().int().min(1).max(365).default(30),
    downloadLimit: z.number().int().min(1).max(100).default(5),
    shopEmail: z.string().trim().email().optional(),
    termsUrl: z.string().trim().url().refine((u) => /^https?:\/\//.test(u), 'Use an http or https link').optional(),
// in superRefine: every bank account currency is in `currencies` and appears once.
```

The admin's existing Shop settings page sends only `currencies`, `defaultCurrency` and `vatRates`; Zod defaults would then reset the new fields. `SettingsService.replace` merges: fields absent from the request body keep their stored values (parse with `.partial()` for the new fields, or merge `current` under `input` before saving). Add a test that a `PUT` with only currencies keeps `unpaidCancelDays: 10`.

`models/shipping.model.ts`:

```ts
import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_ON_DELIVERY';
export const PAYMENT_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CASH_ON_DELIVERY'];

export interface IShippingZone extends Document { name: string; countries: string[]; rest: boolean; order: number }
export interface ShippingBand { upToGrams: number | null; prices: Record<string, number> }
export interface ShippingRate { zoneId: mongoose.Types.ObjectId; bands: ShippingBand[] }
export interface IShippingMethod extends Document {
  labels: Record<string, string>;
  active: boolean;
  paymentMethods: PaymentMethod[];
  codFees: Record<string, number>;
  freeOver: Record<string, number>;
  rates: ShippingRate[];
  order: number;
}

const json = { transform: (_d: unknown, ret: Record<string, unknown>) => { const { _id, __v, ...rest } = ret; void __v; return { id: String(_id), ...rest }; } };

const ZoneSchema = new Schema<IShippingZone>(
  { name: { type: String, required: true, trim: true }, countries: { type: [String], default: [] }, rest: { type: Boolean, default: false }, order: { type: Number, default: 0, index: true } },
  { timestamps: true, toJSON: json }
);

const MethodSchema = new Schema<IShippingMethod>(
  {
    labels: { type: Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true },
    paymentMethods: { type: [String], enum: PAYMENT_METHODS, default: ['BANK_TRANSFER'] },
    codFees: { type: Schema.Types.Mixed, default: {} },
    freeOver: { type: Schema.Types.Mixed, default: {} },
    rates: [{ _id: false, zoneId: { type: Schema.Types.ObjectId, ref: 'ShippingZone', index: true }, bands: [{ _id: false, upToGrams: { type: Number, default: null }, prices: { type: Schema.Types.Mixed, default: {} } }] }],
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true, minimize: false, toJSON: json }
);

export const ShippingZoneModel = mongoose.model<IShippingZone>('ShippingZone', ZoneSchema);
export const ShippingMethodModel = mongoose.model<IShippingMethod>('ShippingMethod', MethodSchema);
```

`shipping.service.ts` rules (all `AppError`):
- Zone: countries uppercased, each `^[A-Z]{2}$` (400), not in another zone (409 "CZ is already in Czechia"), `rest` zones have no countries and at most one exists (409). Delete refused when a method rate uses it (409).
- Method: default-language label (400); `paymentMethods` non-empty subset (400); currencies in `codFees`, `freeOver` and band prices are configured (400); every `zoneId` exists (400) and appears once; bands non-empty, `upToGrams` strictly increasing, only the last may be `null` (400); prices integers ≥ 0.
- New items get `order = count`; lists sort by `order` (indexed).

Zod schemas `zoneSchema`, `methodSchema` in `commerce.schema.ts` for shapes; routes behind `authMiddleware` with `validate(...)`.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): shop settings for checkout and shipping zones and methods"
```

---

## Task 2: Pricing

**Files:**
- Create: `modules/commerce/pricing.ts`, `modules/commerce/pricing.test.ts`, `modules/commerce/pricing-context.ts`, `modules/commerce/pricing-context.test.ts`

**Interfaces:**
- Consumes: catalogue models, `label` and `contentFor` from `public-shop.service.ts` (export them in this task), shipping models (Task 1).
- Produces:

```ts
export interface CartInput {
  currency: string
  language: string
  items: { variantId: string; quantity: number }[]
  country?: string
  shippingMethodId?: string
  paymentMethod?: PaymentMethod
}

export interface PricingContext {
  currency: { code: string; decimals: number }
  language: string
  defaultLanguage: string
  variants: Map<string, { id: string; productId: string; itemId: string; sku: string; type: 'PHYSICAL' | 'DIGITAL'; name: string; optionLabels: { option: string; value: string }[]; price?: number; vatRate: number; weightGrams: number; tracked: boolean; quantity: number; forSale: boolean }>
  zones: { id: string; countries: string[]; rest: boolean }[]
  methods: { id: string; name: string; paymentMethods: PaymentMethod[]; codFees: Record<string, number>; freeOver: Record<string, number>; rates: { zoneId: string; bands: { upToGrams: number | null; prices: Record<string, number> }[] }[] }[]
}

export type LineProblem = 'NOT_FOR_SALE' | 'NO_PRICE' | 'OUT_OF_STOCK' | 'NOT_ENOUGH_STOCK'

export interface Quote {
  currency: string
  lines: { variantId: string; productId: string; itemId: string; sku: string; type: 'PHYSICAL' | 'DIGITAL'; name: string; optionLabels: { option: string; value: string }[]; unitPrice: number; quantity: number; lineTotal: number; vatRate: number; weightGrams: number; problem?: LineProblem; availableQuantity?: number | null }[]
  weightGrams: number
  hasPhysical: boolean
  hasDigital: boolean
  shippingOptions: { id: string; name: string; price: number; paymentMethods: { method: PaymentMethod; fee: number }[] }[]
  shipping: { methodId: string; name: string; price: number } | null
  payment: { method: PaymentMethod; fee: number } | null
  totals: { items: number; shipping: number; paymentFee: number; total: number; vat: { rate: number; base: number; amount: number }[] }
  problems: string[]  // 'LINES', 'NO_SHIPPING', 'SHIPPING_REQUIRED', 'PAYMENT_NOT_ALLOWED'
}

export function priceCart(input: CartInput, ctx: PricingContext): Quote
export async function loadPricingContext(input: CartInput): Promise<PricingContext>
export async function quote(input: CartInput): Promise<Quote>  // load + price
```

- [ ] **Step 1: Write the failing tests** `modules/commerce/pricing.test.ts` (pure, no database)

```ts
import { priceCart, type PricingContext } from './pricing'

const v = (id: string, over: Partial<PricingContext['variants'] extends Map<string, infer V> ? V : never> = {}) => ({
  id, productId: 'p-' + id, itemId: 'i-' + id, sku: id.toUpperCase(), type: 'PHYSICAL' as const, name: 'Tee', optionLabels: [],
  price: 49000, vatRate: 2100, weightGrams: 500, tracked: true, quantity: 10, forSale: true, ...over,
})

function ctx(over: Partial<PricingContext> = {}): PricingContext {
  return {
    currency: { code: 'CZK', decimals: 2 },
    language: 'en',
    defaultLanguage: 'en',
    variants: new Map([['tee', v('tee')], ['book', v('book', { type: 'DIGITAL', weightGrams: 0, tracked: false, price: 29900, vatRate: 1200 })]]),
    zones: [{ id: 'cz', countries: ['CZ'], rest: false }, { id: 'rest', countries: [], rest: true }],
    methods: [
      { id: 'courier', name: 'Courier', paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'], codFees: { CZK: 3900 }, freeOver: { CZK: 200000 },
        rates: [{ zoneId: 'cz', bands: [{ upToGrams: 2000, prices: { CZK: 12900 } }, { upToGrams: null, prices: { CZK: 19900 } }] }] },
      { id: 'abroad', name: 'Abroad', paymentMethods: ['BANK_TRANSFER'], codFees: {}, freeOver: {},
        rates: [{ zoneId: 'rest', bands: [{ upToGrams: null, prices: { CZK: 49900 } }] }] },
    ],
    ...over,
  }
}

it('prices lines, picks the weight band and adds the cash on delivery fee', () => {
  const q = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 5 }], country: 'CZ', shippingMethodId: 'courier', paymentMethod: 'CASH_ON_DELIVERY' }, ctx())
  expect(q.lines[0]).toMatchObject({ unitPrice: 49000, quantity: 5, lineTotal: 245000 })
  expect(q.weightGrams).toBe(2500)
  // 245000 is over the free threshold of 200000.
  expect(q.shipping).toEqual({ methodId: 'courier', name: 'Courier', price: 0 })
  expect(q.payment).toEqual({ method: 'CASH_ON_DELIVERY', fee: 3900 })
  expect(q.totals).toMatchObject({ items: 245000, shipping: 0, paymentFee: 3900, total: 248900 })
  expect(q.problems).toEqual([])
})

it('uses the band for the weight and offers only methods for the country', () => {
  const light = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }], country: 'CZ' }, ctx())
  expect(light.shippingOptions.map((o) => [o.id, o.price])).toEqual([['courier', 12900]])
  const de = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }], country: 'DE' }, ctx())
  expect(de.shippingOptions.map((o) => o.id)).toEqual(['abroad'])
  const noZone = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }], country: 'CZ' }, ctx({ zones: [{ id: 'sk', countries: ['SK'], rest: false }] }))
  expect(noZone.shippingOptions).toEqual([])
  expect(noZone.problems).toContain('NO_SHIPPING')
})

it('never offers cash on delivery with a digital line, and digital-only carts skip shipping', () => {
  const mixed = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }, { variantId: 'book', quantity: 1 }], country: 'CZ', shippingMethodId: 'courier', paymentMethod: 'CASH_ON_DELIVERY' }, ctx())
  expect(mixed.shippingOptions[0].paymentMethods.map((p) => p.method)).toEqual(['BANK_TRANSFER'])
  expect(mixed.problems).toContain('PAYMENT_NOT_ALLOWED')
  const digital = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'book', quantity: 2 }], paymentMethod: 'BANK_TRANSFER' }, ctx())
  expect(digital).toMatchObject({ shipping: null, shippingOptions: [], hasPhysical: false, payment: { method: 'BANK_TRANSFER', fee: 0 } })
  expect(digital.problems).toEqual([])
})

it('reports line problems', () => {
  const c = ctx({ variants: new Map([['tee', v('tee', { quantity: 2 })], ['gone', v('gone', { forSale: false })], ['eur', v('eur', { price: undefined })]]) })
  const q = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 3 }, { variantId: 'gone', quantity: 1 }, { variantId: 'eur', quantity: 1 }, { variantId: 'missing', quantity: 1 }], country: 'CZ' }, c)
  expect(q.lines.map((l) => [l.variantId, l.problem, l.availableQuantity])).toEqual([
    ['tee', 'NOT_ENOUGH_STOCK', 2],
    ['gone', 'NOT_FOR_SALE', undefined],
    ['eur', 'NO_PRICE', undefined],
    ['missing', 'NOT_FOR_SALE', undefined],
  ])
  expect(q.problems).toContain('LINES')
})

it('splits VAT per rate and taxes shipping and fees at the highest line rate', () => {
  const q = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }, { variantId: 'book', quantity: 1 }], country: 'CZ', shippingMethodId: 'courier', paymentMethod: 'BANK_TRANSFER' }, ctx())
  // tee 49000 @21 %, book 29900 @12 %, shipping 12900 @21 % (highest line rate)
  expect(q.totals.vat).toEqual([
    { rate: 2100, base: 51157, amount: 10743 },
    { rate: 1200, base: 26696, amount: 3204 },
  ])
  expect(q.totals.total).toBe(91800)
})

it('merges repeated lines of the same variant', () => {
  const q = priceCart({ currency: 'CZK', language: 'en', items: [{ variantId: 'tee', quantity: 1 }, { variantId: 'tee', quantity: 2 }], country: 'CZ' }, ctx())
  expect(q.lines).toHaveLength(1)
  expect(q.lines[0].quantity).toBe(3)
})
```

(VAT check: gross 21 % = 49000 + 12900 = 61900, amount = round(61900 × 2100 / 12100) = 10743, base 51157; 12 %: gross 29900, amount = round(29900 × 1200 / 11200) = 3204, base 26696.)

`pricing-context.test.ts` (database): seeds settings, languages `en`/`cs`, a product with a Size option and variants via `ProductsService`, a published entry with a Czech version, a zone and a method; asserts `loadPricingContext({ currency: 'CZK', language: 'cs', items: [...] })` returns the Czech product name, Czech option labels with English fallback, `forSale: false` for an inactive product or an unpublished entry, `price` undefined when the variant has no price in the currency, the VAT rate from settings, and that `loadPricingContext` rejects an unknown currency or language with 400 (reuse `resolveCurrency` and `resolveLanguage`).

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- pricing`
Expected: FAIL: modules missing.

- [ ] **Step 3: Implement**

`pricing.ts`:

```ts
import type { PaymentMethod } from '../../models/shipping.model';

const vatOf = (gross: number, rate: number) => Math.round((gross * rate) / (10000 + rate));

export function priceCart(input: CartInput, ctx: PricingContext): Quote {
  const merged = new Map<string, number>();
  for (const item of input.items) merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + item.quantity);

  const lines: Quote['lines'] = [...merged].map(([variantId, quantity]) => {
    const v = ctx.variants.get(variantId);
    if (!v || !v.forSale) {
      return { variantId, productId: v?.productId ?? '', itemId: v?.itemId ?? '', sku: v?.sku ?? '', type: v?.type ?? 'PHYSICAL', name: v?.name ?? '', optionLabels: v?.optionLabels ?? [], unitPrice: 0, quantity, lineTotal: 0, vatRate: 0, weightGrams: 0, problem: 'NOT_FOR_SALE' };
    }
    const base = { variantId, productId: v.productId, itemId: v.itemId, sku: v.sku, type: v.type, name: v.name, optionLabels: v.optionLabels, vatRate: v.vatRate, weightGrams: v.weightGrams, quantity };
    if (v.price === undefined) return { ...base, unitPrice: 0, lineTotal: 0, problem: 'NO_PRICE' };
    let problem: LineProblem | undefined;
    if (v.tracked && v.quantity <= 0) problem = 'OUT_OF_STOCK';
    else if (v.tracked && v.quantity < quantity) problem = 'NOT_ENOUGH_STOCK';
    return { ...base, unitPrice: v.price, lineTotal: v.price * quantity, ...(problem ? { problem, availableQuantity: v.quantity } : {}) };
  });

  const problems: string[] = [];
  if (lines.some((l) => l.problem)) problems.push('LINES');
  const priced = lines.filter((l) => !l.problem);
  const items = priced.reduce((sum, l) => sum + l.lineTotal, 0);
  const hasPhysical = priced.some((l) => l.type === 'PHYSICAL');
  const hasDigital = priced.some((l) => l.type === 'DIGITAL');
  const weightGrams = priced.filter((l) => l.type === 'PHYSICAL').reduce((s, l) => s + l.weightGrams * l.quantity, 0);
  const code = ctx.currency.code;

  let shippingOptions: Quote['shippingOptions'] = [];
  if (hasPhysical && input.country) {
    const country = input.country.toUpperCase();
    const zone = ctx.zones.find((z) => z.countries.includes(country)) ?? ctx.zones.find((z) => z.rest);
    shippingOptions = zone
      ? ctx.methods.flatMap((m) => {
          const band = m.rates.find((r) => r.zoneId === zone.id)?.bands.find((b) => b.upToGrams === null || weightGrams <= b.upToGrams);
          const bandPrice = band?.prices[code];
          if (bandPrice === undefined) return [];
          const free = m.freeOver[code] !== undefined && items >= m.freeOver[code];
          const payments = m.paymentMethods
            // Cash on delivery is never offered with a digital line; without a fee in the currency it costs 0.
            .filter((p) => !(p === 'CASH_ON_DELIVERY' && hasDigital))
            .map((p) => ({ method: p, fee: p === 'CASH_ON_DELIVERY' ? m.codFees[code] ?? 0 : 0 }));
          return payments.length ? [{ id: m.id, name: m.name, price: free ? 0 : bandPrice, paymentMethods: payments }] : [];
        })
      : [];
    if (shippingOptions.length === 0) problems.push('NO_SHIPPING');
  }

  let shipping: Quote['shipping'] = null;
  let payment: Quote['payment'] = null;
  if (hasPhysical) {
    const chosen = shippingOptions.find((o) => o.id === input.shippingMethodId);
    if (input.shippingMethodId && !chosen) problems.push('SHIPPING_REQUIRED');
    if (chosen) {
      shipping = { methodId: chosen.id, name: chosen.name, price: chosen.price };
      if (input.paymentMethod) {
        const allowed = chosen.paymentMethods.find((p) => p.method === input.paymentMethod);
        if (allowed) payment = { method: allowed.method, fee: allowed.fee };
        else problems.push('PAYMENT_NOT_ALLOWED');
      }
    }
  } else if (input.paymentMethod) {
    if (input.paymentMethod === 'BANK_TRANSFER') payment = { method: 'BANK_TRANSFER', fee: 0 };
    else problems.push('PAYMENT_NOT_ALLOWED');
  }

  const shippingPrice = shipping?.price ?? 0;
  const paymentFee = payment?.fee ?? 0;
  const topRate = Math.max(0, ...priced.map((l) => l.vatRate));
  const grossByRate = new Map<number, number>();
  for (const l of priced) grossByRate.set(l.vatRate, (grossByRate.get(l.vatRate) ?? 0) + l.lineTotal);
  if (shippingPrice + paymentFee > 0) grossByRate.set(topRate, (grossByRate.get(topRate) ?? 0) + shippingPrice + paymentFee);
  const vat = [...grossByRate]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, gross]) => ({ rate, base: gross - vatOf(gross, rate), amount: vatOf(gross, rate) }));

  return {
    currency: code,
    lines,
    weightGrams,
    hasPhysical,
    hasDigital,
    shippingOptions,
    shipping,
    payment,
    totals: { items, shipping: shippingPrice, paymentFee, total: items + shippingPrice + paymentFee, vat },
    problems,
  };
}
```

`pricing-context.ts`: `loadPricingContext(input)`:
1. `language`/`defaultLanguage` via `resolveLanguage(input.language)`, `currency` via `resolveCurrency(input.currency)` and the settings entry.
2. Variants `$in` the item ids (valid ObjectIds only), their products, published content for their items via `contentFor(itemIds, language, defaultLanguage)` (export it from `public-shop.service.ts`), settings VAT rates.
3. `forSale` = product active, variant active, content exists (catalogue spec 4.5 rules 1 to 3); `price` = `variant.prices[currency]`; `name` = content `data.name` or entry `title`; `optionLabels` from product options with `label()` (export it).
4. Zones and active methods; method `name` = `label(method.labels, language, defaultLanguage)`.

`quote(input)` = `priceCart(input, await loadPricingContext(input))`.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): cart pricing"
```

---

## Task 3: Payment providers and the quote endpoint

**Files:**
- Create: `modules/commerce/payments.ts`, `modules/commerce/payments.test.ts`, `modules/commerce/checkout.schema.ts`, `modules/commerce/public-checkout.test.ts`
- Modify: `modules/public/public.controller.ts`, `modules/public/public.routes.ts`, `middleware/rateLimit.middleware.ts` (`orderLimiter`)

**Interfaces:**
- Produces:
  - `interface PaymentInstructions { holder; accountNumber?; iban?; bic?; amount; currency; reference; qr?: string }`
  - `interface PaymentProvider { method: PaymentMethod; instructions(order: OrderLike, settings: IShopSettings): PaymentInstructions | undefined }`, `providers: Record<PaymentMethod, PaymentProvider>`
  - `spdString({ iban, amount, decimals, currency, reference, message }): string`
  - `quoteSchema` (Zod) for the body; routes `POST /public/shop/quote`, `GET /public/shop/shipping-countries`

- [ ] **Step 1: Write the failing tests**

`payments.test.ts`:

```ts
import { providers, spdString } from './payments'

it('builds an SPD payment string with amount, currency and reference', () => {
  expect(spdString({ iban: 'CZ6508000000192000145399', amount: 248900, decimals: 2, currency: 'CZK', reference: '2026000001', message: 'Shop 2026000001' })).toBe(
    'SPD*1.0*ACC:CZ6508000000192000145399*AM:2489.00*CC:CZK*X-VS:2026000001*MSG:SHOP 2026000001',
  )
})

it('strips characters SPD does not allow from the message', () => {
  expect(spdString({ iban: 'CZ65', amount: 100, decimals: 2, currency: 'CZK', reference: '1', message: 'Kolo*Šumava' })).toContain('MSG:KOLO SUMAVA')
})

it('gives bank transfer instructions from the currency account, with a QR code only when there is an IBAN', () => {
  const order = { number: '2026000001', currency: 'CZK', totals: { total: 248900 } }
  const settings = {
    currencies: [{ code: 'CZK', decimals: 2 }],
    bankAccounts: [{ currency: 'CZK', accountNumber: '19-2000145399/0800', iban: 'CZ6508000000192000145399', holder: 'Pavel F.' }],
  }
  const withIban = providers.BANK_TRANSFER.instructions(order as never, settings as never)
  expect(withIban).toMatchObject({ holder: 'Pavel F.', accountNumber: '19-2000145399/0800', amount: 248900, reference: '2026000001' })
  expect(withIban?.qr).toMatch(/^SPD\*1\.0\*ACC:CZ65/)
  const noIban = providers.BANK_TRANSFER.instructions(order as never, { ...settings, bankAccounts: [{ currency: 'CZK', accountNumber: '1/0800', holder: 'P' }] } as never)
  expect(noIban?.qr).toBeUndefined()
  expect(providers.CASH_ON_DELIVERY.instructions(order as never, settings as never)).toBeUndefined()
})
```

`public-checkout.test.ts` (supertest against `/public`, `apiKeyMiddleware` mocked): seed settings, languages, a tee (physical, CZK 490, stock 3) and a guide (digital, CZK 299), a CZ zone, a courier method; assert
- `POST /public/shop/quote` with `{ items: [tee×2, guide×1], country: 'CZ', shippingMethodId, paymentMethod: 'BANK_TRANSFER' }` returns lines with names, `shippingOptions` without cash on delivery (digital line), totals and `problems: []`;
- quantity 0 or 100, 51 items, or an unknown variant id format return 400;
- `GET /public/shop/shipping-countries` returns `['CZ']` (sorted, unique; the rest zone adds nothing).

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- payments public-checkout`
Expected: FAIL.

- [ ] **Step 3: Implement**

`payments.ts`:

```ts
import type { IShopSettings } from '../../models/shop-settings.model';
import type { PaymentMethod } from '../../models/shipping.model';

export interface PaymentInstructions {
  holder: string
  accountNumber?: string
  iban?: string
  bic?: string
  amount: number
  currency: string
  reference: string
  qr?: string
}

export interface OrderLike { number: string; currency: string; totals: { total: number } }

export interface PaymentProvider {
  method: PaymentMethod
  instructions(order: OrderLike, settings: Pick<IShopSettings, 'currencies' | 'bankAccounts'>): PaymentInstructions | undefined
}

/** SPD (Czech QR payment) string. Characters outside SPD's set are replaced; "*" separates fields. */
export function spdString(p: { iban: string; amount: number; decimals: number; currency: string; reference: string; message: string }): string {
  const message = p.message.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 $%+\-./:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const amount = (p.amount / 10 ** p.decimals).toFixed(p.decimals);
  return `SPD*1.0*ACC:${p.iban}*AM:${amount}*CC:${p.currency}*X-VS:${p.reference}*MSG:${message}`;
}

const bankTransfer: PaymentProvider = {
  method: 'BANK_TRANSFER',
  instructions(order, settings) {
    const account = settings.bankAccounts?.find((a) => a.currency === order.currency);
    if (!account) return undefined;
    const decimals = settings.currencies.find((c) => c.code === order.currency)?.decimals ?? 2;
    return {
      holder: account.holder,
      accountNumber: account.accountNumber,
      iban: account.iban,
      bic: account.bic,
      amount: order.totals.total,
      currency: order.currency,
      reference: order.number,
      ...(account.iban ? { qr: spdString({ iban: account.iban, amount: order.totals.total, decimals, currency: order.currency, reference: order.number, message: `Shop ${order.number}` }) } : {}),
    };
  },
};

const cashOnDelivery: PaymentProvider = { method: 'CASH_ON_DELIVERY', instructions: () => undefined };

export const providers: Record<PaymentMethod, PaymentProvider> = { BANK_TRANSFER: bankTransfer, CASH_ON_DELIVERY: cashOnDelivery };
```

(The test expects the message "Shop 2026000001" in upper case; `KOLO SUMAVA` shows the `*` replaced by a space and diacritics removed.)

`checkout.schema.ts`:

```ts
import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
export const quoteBody = z.object({
  currency: z.string().optional(),
  language: z.string().optional(),
  items: z.array(z.object({ variantId: objectId, quantity: z.number().int().min(1).max(99) })).min(1).max(50),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  shippingMethodId: objectId.optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH_ON_DELIVERY']).optional(),
});
export const quoteSchema = z.object({ body: quoteBody });
```

Controller `quote`: `res.json({ success: true, data: await quote(req.body) })`. `shippingCountries`: distinct countries of zones, sorted. `orderLimiter` in `rateLimit.middleware.ts`: 10 per minute, key = API key + IP (follow the existing limiter's key generator).

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): payment providers, SPD QR string and the quote endpoint"
```

---

## Task 4: Placing orders

**Files:**
- Create: `models/order.model.ts`, `models/counter.model.ts`, `modules/commerce/orders.service.ts`, `modules/commerce/orders.test.ts`
- Modify: `modules/commerce/checkout.schema.ts` (`orderBody`), public controller and routes

**Interfaces:**
- Consumes: `quote`, `loadPricingContext`, `priceCart` (Task 2), `providers` (Task 3).
- Produces:
  - `OrderModel`, `IOrder` (spec 3.4), `CounterModel`
  - `nextOrderNumber(date?: Date): Promise<string>`
  - `placeOrder(input: OrderInput, opts: { idempotencyKey?: string; siteId?: string }): Promise<{ order: IOrder; instructions?: PaymentInstructions }>` throwing `AppError` 409 with `reason` (`PRICE_CHANGED` + `quote`, `OUT_OF_STOCK` + `lines`) and 400 (`NO_SHIPPING`, `TERMS`, `SHIPPING_REQUIRED`, `PAYMENT_REQUIRED`, `LINES`)
  - `reserveStock(lines): Promise<void>`, `releaseStock(lines): Promise<void>`
  - `publicOrderView(order, settings)`; routes `POST /public/shop/orders`, `GET /public/shop/orders/:number`
  - Hook `onOrderPlaced(order)` (no-op here; Task 6 sends emails, Task 5 fires the webhook)

`AppError` needs to carry data for 409 bodies: add an optional `details` (object) to `AppError` and have `errorMiddleware` spread `details` into the JSON (check how `errorMiddleware` builds the body; keep `success`/`error`).

- [ ] **Step 1: Write the failing test** `modules/commerce/orders.test.ts`

```ts
jest.mock('../../middleware/apiKey.middleware', () => ({ apiKeyMiddleware: (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { VariantModel } from '../../models/variant.model';
import { OrderModel } from '../../models/order.model';
import { seedShop, type Shop } from './test-shop';
import { nextOrderNumber } from './orders.service';
import publicRoutes from '../public/public.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/public', publicRoutes);
app.use(errorMiddleware);

let shop: Shop;
beforeEach(async () => {
  shop = await seedShop();
});

const customer = { email: 'jana@example.test', name: 'Jana Nováková', phone: '+420 777 000 111' };
const address = { name: 'Jana Nováková', street: 'Hlavní 1', city: 'Praha', postalCode: '11000', country: 'CZ' };

function body(over: Record<string, unknown> = {}) {
  return {
    currency: 'CZK',
    language: 'cs',
    items: [{ variantId: shop.teeS, quantity: 1 }, { variantId: shop.guide, quantity: 1 }],
    country: 'CZ',
    shippingMethodId: shop.courier,
    paymentMethod: 'BANK_TRANSFER',
    customer,
    billingAddress: address,
    shippingAddress: address,
    acceptTerms: true,
    expectedTotal: 49000 + 29900 + 12900,
    ...over,
  };
}

it('places an order, reserves stock and returns bank transfer instructions with a QR string', async () => {
  const res = await request(app).post('/public/shop/orders').send(body())
  expect(res.status).toBe(201)
  expect(res.body.data).toMatchObject({ number: expect.stringMatching(/^\d{10}$/), total: 91800, currency: 'CZK', payment: { method: 'BANK_TRANSFER', instructions: { reference: res.body.data.number, qr: expect.stringMatching(/^SPD/) } } })
  expect(res.body.data.accessToken).toHaveLength(43)
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(2)
  const order = await OrderModel.findOne({ number: res.body.data.number }).lean()
  expect(order).toMatchObject({ status: 'PLACED', paymentStatus: 'UNPAID', fulfilmentStatus: 'UNFULFILLED', language: 'cs' })
  expect(order?.lines.map((l) => [l.sku, l.name, l.unitPrice])).toEqual([['TEE-S', 'Cyklistické tričko', 49000], ['GUIDE', 'Průvodce Šumavou', 29900]])
})

it('lets a customer read the order with the token only', async () => {
  const placed = (await request(app).post('/public/shop/orders').send(body())).body.data
  const ok = await request(app).get(`/public/shop/orders/${placed.number}`).query({ token: placed.accessToken })
  expect(ok.body.data).toMatchObject({ number: placed.number, status: 'PLACED', paymentStatus: 'UNPAID', totals: { total: 91800 } })
  expect((await request(app).get(`/public/shop/orders/${placed.number}`).query({ token: 'x' })).status).toBe(404)
})

it('says the price changed when the expected total differs, and reserves nothing', async () => {
  const res = await request(app).post('/public/shop/orders').send(body({ expectedTotal: 1 }))
  expect(res.status).toBe(409)
  expect(res.body).toMatchObject({ reason: 'PRICE_CHANGED', quote: { totals: { total: 91800 } } })
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(3)
  expect(await OrderModel.countDocuments()).toBe(0)
})

it('sells the last unit to exactly one of two simultaneous orders', async () => {
  await VariantModel.updateOne({ _id: shop.teeS }, { $set: { 'stock.quantity': 1 } })
  const one = { ...body(), items: [{ variantId: shop.teeS, quantity: 1 }], expectedTotal: 49000 + 12900 }
  const results = await Promise.all([request(app).post('/public/shop/orders').send(one), request(app).post('/public/shop/orders').send(one)])
  expect(results.map((r) => r.status).sort()).toEqual([201, 409])
  expect(results.find((r) => r.status === 409)?.body.reason).toBe('OUT_OF_STOCK')
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(0)
  expect(await OrderModel.countDocuments()).toBe(1)
})

it('undoes earlier reservations when a later line runs out', async () => {
  await VariantModel.updateOne({ _id: shop.teeM }, { $set: { 'stock.quantity': 0 } })
  const both = { ...body(), items: [{ variantId: shop.teeS, quantity: 1 }, { variantId: shop.teeM, quantity: 1 }] }
  const res = await request(app).post('/public/shop/orders').send(both)
  expect(res.status).toBe(409)
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(3)
})

it('returns the same order for a retried request with the same Idempotency-Key', async () => {
  const a = await request(app).post('/public/shop/orders').set('Idempotency-Key', 'k-1').send(body())
  const b = await request(app).post('/public/shop/orders').set('Idempotency-Key', 'k-1').send(body())
  expect(b.status).toBe(200)
  expect(b.body.data.number).toBe(a.body.data.number)
  expect(await OrderModel.countDocuments()).toBe(1)
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(2)
})

it('requires terms, a shipping address and a shipping method for physical items', async () => {
  expect((await request(app).post('/public/shop/orders').send(body({ acceptTerms: false }))).status).toBe(400)
  expect((await request(app).post('/public/shop/orders').send(body({ shippingAddress: undefined }))).status).toBe(400)
  expect((await request(app).post('/public/shop/orders').send(body({ shippingMethodId: undefined }))).status).toBe(400)
  expect((await request(app).post('/public/shop/orders').send(body({ paymentMethod: 'CASH_ON_DELIVERY' }))).status).toBe(400)
})

it('numbers orders uniquely under concurrency', async () => {
  const numbers = await Promise.all(Array.from({ length: 20 }, () => nextOrderNumber(new Date('2026-10-01T10:00:00Z'))))
  expect(new Set(numbers).size).toBe(20)
  expect(numbers.sort()[0]).toBe('2026000001')
})
```

Create `modules/commerce/test-shop.ts` (test helper, also used by Tasks 5 to 7): languages `en` (default) and `cs`; settings CZK/EUR, VAT 21 % and 12 %, a CZK bank account with IBAN, `termsUrl`, `shopEmail`; a physical "Bike T-shirt" with Size S/M (S stock 3, M stock 3, CZK 49000, weight 500 g, VAT 21 %) with a published Czech version "Cyklistické tričko" and labels; a digital "Šumava guide" (CZK 29900, VAT 12 %, Czech name "Průvodce Šumavou", a fake `digitalFile`); a CZ zone; a "Courier" method (bank transfer and cash on delivery, COD fee 3900, band up to 2000 g 12900, then 19900). Returns ids `{ teeS, teeM, guide, courier, zoneCz, teeProduct, guideProduct }` (strings).

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- orders.test`
Expected: FAIL: 404.

- [ ] **Step 3: Implement**

`models/counter.model.ts`: `{ _id: String, value: Number }` (`_id` is the key, no other indexes).

`models/order.model.ts`: the spec 3.4 shape with sub-schemas `_id: false`; indexes `number` (unique), `idempotencyKey` (sparse), `status`, `paymentStatus`, `fulfilmentStatus`, `createdAt`, `updatedAt`, `customer.email`. `toJSON` maps `_id` to `id`.

`orders.service.ts`:

```ts
export async function nextOrderNumber(date = new Date()): Promise<string> {
  const year = date.getUTCFullYear();
  const counter = await CounterModel.findOneAndUpdate({ _id: `order-${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true });
  return `${year}${String(counter.value).padStart(6, '0')}`;
}

/** Decrement tracked stock line by line; undo what was taken if any line cannot be served. */
export async function reserveStock(lines: { variantId: string; quantity: number }[]): Promise<void> {
  const taken: { variantId: string; quantity: number }[] = [];
  for (const line of lines) {
    const variant = await VariantModel.findById(line.variantId).select('stock').lean();
    if (!variant?.stock?.tracked) continue;
    const updated = await VariantModel.findOneAndUpdate(
      { _id: line.variantId, 'stock.tracked': true, 'stock.quantity': { $gte: line.quantity } },
      { $inc: { 'stock.quantity': -line.quantity } },
      { new: true }
    );
    if (!updated) {
      await releaseStock(taken);
      throw new AppError('Some items are no longer in stock', 409, { reason: 'OUT_OF_STOCK', lines: [line.variantId] });
    }
    taken.push(line);
  }
}

export async function releaseStock(lines: { variantId: string; quantity: number }[]): Promise<void> {
  for (const line of lines) {
    await VariantModel.updateOne({ _id: line.variantId, 'stock.tracked': true }, { $inc: { 'stock.quantity': line.quantity } });
  }
}
```

`placeOrder(input, { idempotencyKey })`:
1. If `idempotencyKey`, return the existing order with that key (and a flag so the controller answers 200).
2. `const q = await quote(input)`; map problems: `LINES` → 409 `OUT_OF_STOCK` when every problem is stock, else 400 `LINES` with the lines; `NO_SHIPPING` → 400; physical without `shippingMethodId` or `shippingAddress` → 400 `SHIPPING_REQUIRED`; no `payment` → 400 `PAYMENT_REQUIRED`; `PAYMENT_NOT_ALLOWED` → 400; `termsUrl` set and `acceptTerms !== true` → 400 `TERMS`.
3. `q.totals.total !== input.expectedTotal` → 409 `PRICE_CHANGED` with `quote: q`.
4. `reserveStock(q.lines)`.
5. Build the order (snapshot lines from the quote, `number = await nextOrderNumber()`, `accessToken = crypto.randomBytes(32).toString('base64url')`, history `[{ at, type: 'placed' }]`) and insert; on insert failure `releaseStock(q.lines)` and rethrow. A duplicate-key error on `idempotencyKey` (a concurrent retry) releases stock and returns the other order.
6. `instructions = providers[payment.method].instructions(order, settings)`.
7. `onOrderPlaced(order)` fire-and-forget.

`orderBody` extends `quoteBody` with `customer` (`email` email, `name` 1 to 100, `phone` up to 30), `billingAddress` and `shippingAddress?` (`name` 1 to 100, `company?`, `street` 1 to 200, `city` 1 to 100, `postalCode` 1 to 20, `country` `^[A-Za-z]{2}$` uppercased, `vatId?` up to 30), `note?` up to 1000, `acceptTerms?` boolean, `expectedTotal` integer ≥ 0. The shipping address country must equal `country` (400 otherwise).

Controller `placeOrder`: `201` with `{ number, accessToken, total, currency, payment: { method, instructions } }` (200 for an idempotent replay). `GET /public/shop/orders/:number?token=` uses a constant-time comparison (`crypto.timingSafeEqual` on equal-length buffers) and returns `publicOrderView`: number, status fields, lines (name, options, quantity, unitPrice, lineTotal), shipping, payment with instructions while unpaid, totals, createdAt. Routes behind `apiKeyMiddleware`; `POST /shop/orders` also behind `orderLimiter`.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): place orders with stock reservation and idempotency"
```

---

## Task 5: Order actions, admin order API, downloads and webhooks

**Files:**
- Create: `models/download-grant.model.ts`, `modules/commerce/order-actions.ts`, `modules/commerce/downloads.service.ts`, `modules/commerce/order-actions.test.ts`, `modules/commerce/downloads.test.ts`
- Modify: `models/webhook.model.ts`, `config/storage.ts` (`privateFileSasUrl`), commerce and public routes and controllers, `orders.service.ts` (`onOrderPlaced` fires `order.placed`)

**Interfaces:**
- Produces:
  - `OrderActions.markPaid(id, by?)`, `markShipped(id, { trackingNumber?, trackingUrl? }, by?)`, `cancel(id, { refunded?: boolean }, by?)`, `resend(id, 'confirmation' | 'downloads', by?)`, `setInternalNote(id, note)`; each returns the order and throws `409` for an invalid state.
  - `OrdersAdminService.list({ page, limit, search?, status?, paymentStatus?, fulfilmentStatus?, sortOrder? })` (sorted by `createdAt`), `get(id)`, `needsAction()`: count of orders with `status: PLACED` and (`paymentStatus: PAID` or `payment.method: CASH_ON_DELIVERY`) and `fulfilmentStatus: UNFULFILLED`.
  - `DownloadGrantModel`, `issueGrants(order, settings): Promise<IDownloadGrant[]>` (expires old ones), `redeem(token): Promise<string>` (SAS URL) throwing `410`.
  - `storageService.privateFileSasUrl(blobName, minutes): string`
  - Webhook events `order.placed`, `order.paid`, `order.shipped`, `order.cancelled`.
  - Hooks consumed by Task 6: `notify(order, kind)` where `kind` is `'confirmation' | 'paid' | 'shipped' | 'cancelled' | 'downloads'`; in this task it is a no-op exported from `order-emails.ts` (stub) so actions call it already.
  - Admin routes: `GET /commerce/orders`, `GET /commerce/orders/needs-action`, `GET /commerce/orders/:id`, `POST /commerce/orders/:id/paid`, `POST /commerce/orders/:id/shipped`, `POST /commerce/orders/:id/cancel`, `POST /commerce/orders/:id/resend`, `PUT /commerce/orders/:id/note`.
  - Public route `GET /public/shop/downloads/:token` (redirect).

- [ ] **Step 1: Write the failing tests**

`order-actions.test.ts` (services directly; storage mocked):

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./order-emails', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

import { useTestDb } from '../../test/db';
import { VariantModel } from '../../models/variant.model';
import { DownloadGrantModel } from '../../models/download-grant.model';
import { WebhookService } from '../../services/webhook.service';
import { notify } from './order-emails';
import { seedShop, placeTestOrder } from './test-shop';
import { OrderActions } from './order-actions';

useTestDb();

it('marks an order paid, issues download grants for digital lines and fires order.paid', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { digital: true });
  const paid = await OrderActions.markPaid(String(order._id), 'admin-1');
  expect(paid.paymentStatus).toBe('PAID');
  expect(paid.history.map((h) => h.type)).toContain('paid');
  expect(await DownloadGrantModel.countDocuments({ orderId: order._id })).toBe(1);
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ number: order.number }), 'paid');
  expect(WebhookService.triggerEvent).toHaveBeenCalledWith('order.paid', expect.objectContaining({ order: expect.objectContaining({ number: order.number }) }));
  await expect(OrderActions.markPaid(String(order._id))).rejects.toMatchObject({ statusCode: 409 });
});

it('completes an order once it is paid and shipped; cash on delivery is paid when shipped', async () => {
  const shop = await seedShop();
  const cod = await placeTestOrder(shop, { payment: 'CASH_ON_DELIVERY' });
  const shipped = await OrderActions.markShipped(String(cod._id), { trackingNumber: 'DR123', trackingUrl: 'https://track.test/DR123' });
  expect(shipped).toMatchObject({ fulfilmentStatus: 'SHIPPED', paymentStatus: 'PAID', status: 'COMPLETED', tracking: { number: 'DR123' } });
});

it('cancels an order, returns stock, and marks a paid one refunded on request', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(2);
  await OrderActions.markPaid(String(order._id));
  const cancelled = await OrderActions.cancel(String(order._id), { refunded: true });
  expect(cancelled).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' });
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(3);
  await expect(OrderActions.markShipped(String(order._id), {})).rejects.toMatchObject({ statusCode: 409 });
  await expect(OrderActions.cancel(String(order._id), {})).rejects.toMatchObject({ statusCode: 409 });
});

it('resending downloads expires the old links and issues new ones', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { digital: true });
  await OrderActions.markPaid(String(order._id));
  const first = await DownloadGrantModel.findOne({ orderId: order._id }).lean();
  await OrderActions.resend(String(order._id), 'downloads');
  const grants = await DownloadGrantModel.find({ orderId: order._id }).lean();
  expect(grants).toHaveLength(2);
  expect(grants.find((g) => g.token === first?.token)?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
});
```

`placeTestOrder(shop, { digital?, payment? })` in `test-shop.ts` calls `placeOrder` with a tee S line (and the guide when `digital`), CZ courier, and the right `expectedTotal` from `quote`.

`downloads.test.ts`: storage mocked with `privateFileSasUrl: jest.fn(() => 'https://blob.test/sas')`; after `markPaid`, `GET /public/shop/downloads/:token` returns 302 to `https://blob.test/sas` and increments `used`; after `limit` uses or after `expiresAt` it returns 410; an unknown token returns 404.

Admin API test in `order-actions.test.ts` (supertest on `/commerce`, auth mocked): `GET /commerce/orders?search=jana` finds the order by email and by number; `paymentStatus=PAID` filters; `GET /commerce/orders/needs-action` counts a paid unshipped order; the actions' routes return the updated order.

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/backend && pnpm test -- order-actions downloads`
Expected: FAIL.

- [ ] **Step 3: Implement**

`order-actions.ts` sketch:

```ts
async function transition(id: string, guard: Record<string, unknown>, update: Record<string, unknown>, history: { type: string; by?: string; detail?: string }) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid order ID', 400);
  const order = await OrderModel.findOneAndUpdate(
    { _id: id, ...guard },
    { $set: update, $push: { history: { at: new Date(), ...history } } },
    { new: true }
  );
  if (!order) {
    if (!(await OrderModel.exists({ _id: id }))) throw new AppError('Order not found', 404);
    throw new AppError('This action is not possible for the order in its current state', 409);
  }
  return order;
}

async function completeIfDone(order: IOrder): Promise<IOrder> {
  if (order.paymentStatus === 'PAID' && order.fulfilmentStatus === 'SHIPPED' && order.status === 'PLACED') {
    return (await OrderModel.findOneAndUpdate({ _id: order._id, status: 'PLACED' }, { $set: { status: 'COMPLETED' } }, { new: true })) ?? order;
  }
  return order;
}

export const OrderActions = {
  async markPaid(id: string, by?: string) {
    let order = await transition(id, { status: 'PLACED', paymentStatus: 'UNPAID' }, { paymentStatus: 'PAID' }, { type: 'paid', by });
    const digitalOnly = order.lines.every((l) => l.type === 'DIGITAL');
    if (order.lines.some((l) => l.type === 'DIGITAL')) await issueGrants(order, await SettingsService.get());
    if (digitalOnly) order = await transition(id, { fulfilmentStatus: 'UNFULFILLED' }, { fulfilmentStatus: 'SHIPPED' }, { type: 'delivered-digital' });
    order = await completeIfDone(order);
    void notify(order, 'paid');
    emitOrderEvent(WebhookEvent.ORDER_PAID, order);
    return order;
  },
  // markShipped: guard { status: 'PLACED', fulfilmentStatus: 'UNFULFILLED' }; set tracking; for CASH_ON_DELIVERY also paymentStatus PAID (history 'paid-on-delivery'); completeIfDone; notify 'shipped'; order.shipped.
  // cancel: guard { status: 'PLACED' } (a COMPLETED order cannot be cancelled: 409); releaseStock(order.lines); paymentStatus REFUNDED when refunded && paid; expire grants; notify 'cancelled'; order.cancelled.
  // resend: 'confirmation' → notify(order, 'confirmation'); 'downloads' (paid orders with digital lines only, else 409) → issueGrants then notify 'downloads'; history 'resent'.
};
```

`issueGrants(order, settings)`: for each digital line, expire existing grants of that order line (`expiresAt = now`), create `{ token: randomBytes(24).toString('base64url'), orderId, lineIndex, productId, expiresAt: now + downloadDays, limit: downloadLimit, used: 0 }`. `DownloadGrantModel`: `token` unique (new collection), `orderId` indexed.

`redeem(token)`: `findOneAndUpdate({ token, expiresAt: { $gt: now }, $expr: { $lt: ['$used', '$limit'] } }, { $inc: { used: 1 } }, { new: true })`; when null, `404` if the token does not exist, else `410`. Then load the product's `digitalFile.blobName` (`410` when missing) and return `storageService.privateFileSasUrl(blobName, 5)`.

(`$expr` support differs on Cosmos DB; if the Cosmos check in Task 8 fails, replace it with a read, a `used < limit` check in code and a conditional update on `used: <read value>`.)

`config/storage.ts`:

```ts
  privateFileSasUrl(blobName: string, minutes: number): string {
    const blob = this.getPrivateContainerClient().getBlobClient(blobName);
    // generateSasUrl needs a StorageSharedKeyCredential, which fromConnectionString provides when the string has an AccountKey.
    return blob.generateSasUrl({ permissions: BlobSASPermissions.parse('r'), expiresOn: new Date(Date.now() + minutes * 60_000) });
  }
```

(`generateSasUrl` is async in recent `@azure/storage-blob` versions; check the installed version and make this `async` if needed, awaiting it in `redeem`.)

Webhooks: add `ORDER_PLACED = 'order.placed'`, `ORDER_PAID`, `ORDER_SHIPPED`, `ORDER_CANCELLED` to `WebhookEvent`; `emitOrderEvent(event, order)` sends `{ order: { id, number, status, paymentStatus, fulfilmentStatus, total, currency } }`; `onOrderPlaced` fires `order.placed`.

Admin list: filter by statuses; `search` matches `number` prefix or `customer.email` (case-insensitive regex, escaped); sort `createdAt` desc (indexed); returns `{ id, number, createdAt, customer: { name, email }, total, currency, status, paymentStatus, fulfilmentStatus }`. Detail returns the full order plus `instructions` for unpaid bank transfers.

Add the orders list and `needsAction` queries to `test/cosmos-sort-indexes.test.ts`.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): order actions, admin order API, downloads and order webhooks"
```

---

## Task 6: Order emails

**Files:**
- Create: `modules/commerce/order-emails.ts` (replace the stub), `modules/commerce/email-strings.ts`, `modules/commerce/order-emails.test.ts`
- Modify: `services/email.service.ts` (generic `send`), `package.json` (`qrcode`, `@types/qrcode`)

**Interfaces:**
- Produces:
  - `EmailService.isReady(): boolean`, `EmailService.send({ to, subject, html, attachments?: { name: string; content: string /* base64 */ }[] }): Promise<void>` (throws when not initialised or Brevo fails)
  - `notify(order, kind)`: renders and sends; records `history` entries `email-sent` (`detail: kind`) or `email-failed` (`detail: '<kind>: <reason>'`); never throws.
  - `renderEmail(order, kind, settings, extra)` returning `{ subject, html, attachments }` (exported for tests).

- [ ] **Step 1: Write the failing test** `modules/commerce/order-emails.test.ts`

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../services/email.service', () => ({ EmailService: { isReady: jest.fn(() => true), send: jest.fn().mockResolvedValue(undefined) } }));

import { useTestDb } from '../../test/db';
import { EmailService } from '../../services/email.service';
import { OrderModel } from '../../models/order.model';
import { seedShop, placeTestOrder } from './test-shop';
import { notify, renderEmail } from './order-emails';
import { SettingsService } from './settings.service';

useTestDb();

it('sends a Czech confirmation with lines, totals, payment instructions and the QR code attached', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { language: 'cs' });
  const email = await renderEmail(order, 'confirmation', await SettingsService.get(), {});
  expect(email.subject).toBe(`Objednávka ${order.number}`);
  expect(email.html).toContain('Cyklistické tričko');
  expect(email.html).toContain('490,00');
  expect(email.html).toContain(order.number);
  expect(email.html).toContain('CZ6508000000192000145399');
  expect(email.attachments).toEqual([{ name: `platba-${order.number}.png`, content: expect.any(String) }]);
});

it('notifies the shop of a new order and records sent emails', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  await notify(order, 'confirmation');
  const sent = jest.mocked(EmailService.send).mock.calls.map((c) => c[0].to);
  expect(sent).toEqual(['jana@example.test', 'shop@example.test']);
  const saved = await OrderModel.findById(order._id).lean();
  expect(saved?.history.filter((h) => h.type === 'email-sent').map((h) => h.detail)).toEqual(['confirmation', 'new-order']);
});

it('records a failed email and does not throw', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  jest.mocked(EmailService.send).mockRejectedValueOnce(new Error('Request failed with status code 401'));
  await expect(notify(order, 'shipped')).resolves.toBeUndefined();
  const saved = await OrderModel.findById(order._id).lean();
  expect(saved?.history.find((h) => h.type === 'email-failed')?.detail).toBe('shipped: Request failed with status code 401');
});

it('records "not configured" when Brevo is off', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  jest.mocked(EmailService.isReady).mockReturnValueOnce(false);
  await notify(order, 'cancelled');
  const saved = await OrderModel.findById(order._id).lean();
  expect(saved?.history.find((h) => h.type === 'email-failed')?.detail).toBe('cancelled: email is not configured');
});

it('includes download links in the paid email for digital lines', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { digital: true });
  const email = await renderEmail(order, 'paid', await SettingsService.get(), { downloads: [{ name: 'Průvodce Šumavou', url: 'https://api.test/public/shop/downloads/abc' }] });
  expect(email.html).toContain('https://api.test/public/shop/downloads/abc');
});
```

(`placeTestOrder` gains a `language` option; it places the order without triggering `notify` side effects in these tests because `order-emails` is the module under test: call `placeOrder` with an option `skipNotify: true`, or reset the `EmailService.send` mock after placing.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm add qrcode && pnpm add -D @types/qrcode && pnpm test -- order-emails`
Expected: FAIL: stub has no `renderEmail`.

- [ ] **Step 3: Implement**

`EmailService.send` (generalise the existing Brevo call; keep `sendFormNotification` working by calling `send`):

```ts
  static isReady(): boolean {
    return EmailService.initialized;
  }

  static async send(options: { to: string; subject: string; html: string; attachments?: { name: string; content: string }[] }): Promise<void> {
    if (!EmailService.initialized) throw new Error('email is not configured');
    const email = new SendSmtpEmail();
    email.sender = { email: process.env.BREVO_FROM_EMAIL || 'noreply@thecms.app', name: process.env.BREVO_FROM_NAME || 'TheCMS' };
    email.to = [{ email: options.to }];
    email.subject = options.subject;
    email.htmlContent = options.html;
    if (options.attachments?.length) email.attachment = options.attachments;
    await EmailService.apiInstance.sendTransacEmail(email);
  }
```

`email-strings.ts`: `{ en: {...}, cs: {...} }` with subjects (`Order {{number}}` / `Objednávka {{number}}`, payment received, shipped, cancelled, new order), headings, labels (Item, Quantity, Price, Shipping, Payment fee, Total, VAT included, Pay by bank transfer, Account, IBAN, Amount, Reference (variable symbol), Scan the QR code in your banking app, Download, Tracking), and short texts. Czech strings written by the implementer with care (for example "Zaplaťte převodem", "Variabilní symbol", "Naskenujte QR kód v bankovní aplikaci", "Stáhnout", "Sledování zásilky"). A `t(language, key, vars)` helper falls back to `en`.

`order-emails.ts`:
- `formatMoney(minor, currency, decimals, language)` with `Intl.NumberFormat` (cs gives `490,00 Kč`).
- `renderEmail(order, kind, settings, extra)`: escaped HTML table of lines (name, options joined " / ", quantity, line total), shipping and fee rows, total, VAT per rate; for `confirmation` with bank transfer: instructions block plus `qrcode.toBuffer(qr, { type: 'png', width: 240 })` attached as `platba-<number>.png` (`payment-<number>.png` in English); for `paid`: download links when `extra.downloads`; for `shipped`: tracking; for `cancelled`: a short text. `new-order` (to `shopEmail`) lists customer, addresses, lines and totals, in English.
- `notify(order, kind)`: loads settings; sends to the customer (and for `confirmation` also `new-order` to `shopEmail` when set); for `paid` and `downloads` builds download links `${PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'}/public/shop/downloads/<token>` from the order's current grants; each send records history with `OrderModel.updateOne({ _id }, { $push: { history: ... } })`; errors are caught and recorded.

Hook it in: `onOrderPlaced` calls `notify(order, 'confirmation')`; `OrderActions` already call `notify`.

Document `PUBLIC_API_URL` and `BREVO_FROM_NAME` in `packages/backend/.env.example`.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): order emails with payment QR code and download links"
```

---

## Task 7: Auto-cancel job

**Files:**
- Create: `modules/commerce/unpaid-job.ts`, `modules/commerce/unpaid-job.test.ts`
- Modify: `main.ts` (start the timer after the database connects; skip when `NODE_ENV === 'test'`)

**Interfaces:**
- Consumes: `OrderActions.cancel` logic (reuse a shared internal `cancelOrder(order, { by: 'system', reason: 'unpaid' })`), `SettingsService`.
- Produces: `cancelStaleUnpaidOrders(now?: Date): Promise<number>`, `startUnpaidJob(intervalMs = 3_600_000): () => void`

- [ ] **Step 1: Write the failing test** `modules/commerce/unpaid-job.test.ts`

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./order-emails', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

import { useTestDb } from '../../test/db';
import { OrderModel } from '../../models/order.model';
import { VariantModel } from '../../models/variant.model';
import { notify } from './order-emails';
import { seedShop, placeTestOrder } from './test-shop';
import { cancelStaleUnpaidOrders } from './unpaid-job';

useTestDb();

it('cancels unpaid bank transfers older than the setting, once, even with two runners', async () => {
  const shop = await seedShop();
  const stale = await placeTestOrder(shop);
  const fresh = await placeTestOrder(shop);
  const cod = await placeTestOrder(shop, { payment: 'CASH_ON_DELIVERY' });
  const old = new Date(Date.now() - 15 * 24 * 3600_000);
  await OrderModel.updateMany({ _id: { $in: [stale._id, cod._id] } }, { $set: { createdAt: old } });
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(0);

  const [a, b] = await Promise.all([cancelStaleUnpaidOrders(), cancelStaleUnpaidOrders()]);
  expect(a + b).toBe(1);
  expect((await OrderModel.findById(stale._id).lean())?.status).toBe('CANCELLED');
  expect((await OrderModel.findById(fresh._id).lean())?.status).toBe('PLACED');
  expect((await OrderModel.findById(cod._id).lean())?.status).toBe('PLACED');
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(1);
  expect(jest.mocked(notify).mock.calls.filter((c) => c[1] === 'cancelled')).toHaveLength(1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- unpaid-job`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
export async function cancelStaleUnpaidOrders(now = new Date()): Promise<number> {
  const settings = await SettingsService.get();
  const before = new Date(now.getTime() - settings.unpaidCancelDays * 24 * 3600_000);
  const candidates = await OrderModel.find({ status: 'PLACED', paymentStatus: 'UNPAID', 'payment.method': 'BANK_TRANSFER', createdAt: { $lt: before } })
    .select('_id')
    .lean();
  let cancelled = 0;
  for (const c of candidates) {
    // The conditional update makes this safe when several instances run the job at once.
    const order = await OrderModel.findOneAndUpdate(
      { _id: c._id, status: 'PLACED', paymentStatus: 'UNPAID' },
      { $set: { status: 'CANCELLED' }, $push: { history: { at: now, type: 'cancelled', by: 'system', detail: 'unpaid' } } },
      { new: true }
    );
    if (!order) continue;
    await releaseStock(order.lines);
    void notify(order, 'cancelled');
    emitOrderEvent(WebhookEvent.ORDER_CANCELLED, order);
    cancelled++;
  }
  return cancelled;
}

export function startUnpaidJob(intervalMs = 3_600_000): () => void {
  const run = () => cancelStaleUnpaidOrders().catch((err) => console.error('Unpaid order job failed:', err));
  const timer = setInterval(run, intervalMs);
  timer.unref();
  void run();
  return () => clearInterval(timer);
}
```

Use the same conditional-update shape in `OrderActions.cancel` (shared helper), so an admin cancel racing the job cannot release stock twice.

`main.ts`: after `ensureProductModel()`, `if (process.env.NODE_ENV !== 'test') startUnpaidJob();`.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): cancel unpaid bank transfer orders automatically"
```

---

## Task 8: Local verification

**Files:** none unless a defect is found (fix with a test).

- [ ] **Step 1: Local run on a throwaway copy of the local database** (copy `thecms` to `thecms_ordertest`, worktree backend on port 3100 with Azurite; Brevo unset).

1. Settings: CZK with a bank account (IBAN `CZ6508000000192000145399`, a test value), terms link, shop email; a CZ zone and a "rest" zone; a courier (bank transfer and cash on delivery, COD fee 39 CZK, bands 2 kg 129 CZK and above 199 CZK, free over 2000 CZK) and an "Abroad" method in the rest zone.
2. A tee with sizes (stock 3) and a digital guide with a small uploaded file; publish both.
3. `POST /public/shop/quote` for CZ and DE; check shipping options, COD hidden with the guide in the cart.
4. `POST /public/shop/orders` for the tee and the guide; check the response instructions and the QR string; stock 2.
5. Turn the QR string into a PNG (`node -e "require('qrcode').toFile('qr.png', '<SPD>')"`) and scan it with a banking app: note which fields the app fills. Record the result honestly (it may not be possible on a test IBAN).
6. Order history shows "email not sent: email is not configured".
7. `POST /commerce/orders/:id/paid`; `GET /public/shop/downloads/<token>` redirects to a working SAS URL on Azurite; after 5 uses, 410.
8. Ship and complete; a second order cancelled by the admin returns stock.
9. Run `cancelStaleUnpaidOrders` against an order with `createdAt` moved back 15 days.

- [ ] **Step 2: Record and commit**

Append "E-shop orders Plan 1 verification" to `TEST_RESULTS.md` (including the Cosmos DB notes to check after deploy: the `$expr` in `redeem`, the counter upsert, and the conditional stock update), drop the throwaway database and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record e-shop orders Plan 1 verification"
```

---

## Self-Review Notes

- **Spec coverage:** 3.1 settings → Task 1; 3.2 and 3.3 shipping → Task 1; 3.4 orders, 3.5 counters → Task 4; 3.6 grants → Task 5; 4 pricing → Task 2; 5 public API: quote and countries → Task 3, orders and order view → Task 4, downloads → Task 5; 6 payment providers and SPD → Task 3; 7 job → Task 7; 8 emails → Task 6; 9 admin → backend API in Task 5, screens in Plan 2; 10 webhooks → Task 5; 11 errors → Tasks 1 to 5; 12 backend tests → every task; Cosmos sort test → Task 5; browser and QR scan → Task 8 and Plan 2.
- **Type consistency:** `CartInput`, `PricingContext`, `Quote`, `priceCart`, `loadPricingContext`, `quote`, `PaymentMethod`, `PaymentInstructions`, `providers`, `spdString`, `nextOrderNumber`, `reserveStock`, `releaseStock`, `placeOrder`, `OrderActions`, `issueGrants`, `redeem`, `notify`, `renderEmail`, `cancelStaleUnpaidOrders`, `startUnpaidJob`, `seedShop`, `placeTestOrder` are used with the same names in every task.
