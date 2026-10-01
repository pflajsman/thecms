# E-shop Catalogue, Plan 1: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The backend stores shop settings, products and variants, keeps every product linked to a content entry of a system "Product" model, stores digital files privately, and serves a read-only public shop API with currency and language.

**Architecture:** A new `commerce` module holds three collections (`shopsettings`, `products`, `variants`) and their services. Product text lives in content entries of a system content type created at startup; guards in the content and language services keep that link intact. The public shop API combines products, for-sale variants and the content fallback from the content languages work.

**Tech Stack:** Express, Mongoose 6, Zod, multer, @azure/storage-blob, Jest, mongodb-memory-server, supertest.

**Spec:** `docs/superpowers/specs/2026-10-01-eshop-catalog-design.md`

**Series:** Plan 1 of 2. Plan 2 covers the admin.

## Global Constraints

- Money is integer minor units; currency codes match `^[A-Z]{3}$`, decimals 0 to 3; VAT rates are basis points 0 to 10000.
- Option and value keys match `^[a-z][a-z0-9-]{0,39}$`; at most 3 options with 50 values each; a label in the default content language is required.
- SKU: 1 to 64 characters, unique across the shop.
- Every `find` sort is served by a single-field index (Azure Cosmos DB); `src/test/cosmos-sort-indexes.test.ts` checks the new lists.
- Unique indexes only on the new, empty collections (`variants.sku`, `products.itemId`).
- Errors use `AppError(message, status)` and the `{ success: false, error }` shape; existing public and admin responses stay unchanged.
- Digital files never get a public URL in this plan.
- Never use an em dash in code comments or docs.

## Decisions (for the reviewer)

1. **For-sale filtering uses `distinct` sets** (product ids with an active variant priced in the currency, item ids with a published product entry) before paging products. It is simple and index-friendly and fine for catalogues of thousands of products; a larger shop would need a denormalised `forSale` flag.
2. **Digital uploads go to disk first** (multer disk storage in the OS temp folder, 500 MB limit) and are streamed to a private container named by `AZURE_STORAGE_PRIVATE_CONTAINER_NAME` (default `downloads`), never into memory like media.
3. **Settings are one document written as a whole** (`PUT /commerce/settings`); the service compares old and new lists to apply the in-use guards.
4. **Deleting a language is blocked when a product entry has versions only in that language** (spec 4.4 says the last version cannot be deleted; language delete is the other path to that state).

## Review Focus

1. **Deleting a language whose versions are the only ones of a product entry**: refused with `409`, nothing deleted. Tested in Task 2.
2. **A variant priced in CZK only, requested in EUR**: the variant is left out, and a product with no other variant is not listed. Tested in Task 5.
3. **Two variants saved with the same SKU, in the same product or across products**: `409` naming the SKU, nothing saved. Tested in Task 3.
4. **Removing an option value that variants use**: the variants for that value are removed only through the regeneration step; settings and products never point at missing currencies, VAT rates or options. Tested in Tasks 1 and 3.
5. **Deleting a product with a digital file when blob storage fails**: the product, variants and entry are still deleted and the failure is logged. Tested in Task 4.

---

## File Structure

All paths relative to `packages/backend/src`.

| File | Responsibility |
|---|---|
| `models/shop-settings.model.ts`, `models/product.model.ts`, `models/variant.model.ts` | Schemas and indexes |
| `modules/commerce/settings.service.ts` | Read and replace settings with in-use guards |
| `modules/commerce/product-model.ts` | `ensureProductModel()`, `PRODUCT_CORE_FIELDS`, `productContentTypeId()` |
| `modules/commerce/products.service.ts` | Create, list, get, update, delete, options and variant regeneration |
| `modules/commerce/variants.service.ts` | Bulk variant update with SKU and price checks |
| `modules/commerce/digital-files.ts` | Upload, replace, delete private files |
| `modules/commerce/commerce.schema.ts`, `commerce.controller.ts`, `commerce.routes.ts` | Admin endpoints under `/commerce` |
| `modules/commerce/public-shop.service.ts`, `modules/public/public.controller.ts`, `public.routes.ts` | Public shop endpoints |
| `config/storage.ts`, `config/upload.ts` | Private container, disk upload |
| `models/content-type.model.ts`, content type, entry and language services | `system` flag and guards |
| `models/webhook.model.ts` | New events |

---

## Task 1: Shop settings and commerce models

**Files:**
- Create: `models/shop-settings.model.ts`, `models/product.model.ts`, `models/variant.model.ts`, `modules/commerce/settings.service.ts`, `modules/commerce/commerce.schema.ts`, `modules/commerce/commerce.controller.ts`, `modules/commerce/commerce.routes.ts`
- Modify: `routes/index.ts` (mount `/commerce`)
- Test: `modules/commerce/settings.test.ts`

**Interfaces:**
- Produces:
  - `ShopSettingsModel`, `IShopSettings { currencies: { code: string; decimals: number }[]; defaultCurrency?: string; vatRates: { id: string; name: string; rate: number }[] }`
  - `ProductModel`, `IProduct { itemId; type: ProductType; vatRateId: string; active: boolean; options: ProductOption[]; digitalFile?: DigitalFile }`, `enum ProductType { PHYSICAL = 'PHYSICAL', DIGITAL = 'DIGITAL' }`, `ProductOption { key; labels: Record<string,string>; values: { key; labels: Record<string,string> }[] }`
  - `VariantModel`, `IVariant { productId; sku; optionValues: Record<string,string>; prices: Record<string,number>; weightGrams: number; stock: { tracked: boolean; quantity: number }; active: boolean }`
  - `SettingsService.get(): Promise<IShopSettings>` (empty lists when none), `SettingsService.replace(input): Promise<IShopSettings>`, `SettingsService.assertReady(): Promise<IShopSettings>` (`409` "Add a currency and a VAT rate first")
  - Routes: `GET /commerce/settings`, `PUT /commerce/settings`

- [ ] **Step 1: Write the failing test** `modules/commerce/settings.test.ts`

```ts
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { ProductModel, ProductType } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import commerceRoutes from './commerce.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/commerce', commerceRoutes);
app.use(errorMiddleware);

const settings = {
  currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
  defaultCurrency: 'CZK',
  vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }, { id: 'zero', name: 'Zero', rate: 0 }],
};

it('starts empty and stores currencies and VAT rates', async () => {
  expect((await request(app).get('/commerce/settings')).body.data).toEqual({ currencies: [], vatRates: [] });
  const saved = await request(app).put('/commerce/settings').send(settings);
  expect(saved.status).toBe(200);
  expect(saved.body.data).toMatchObject(settings);
  expect((await request(app).get('/commerce/settings')).body.data).toMatchObject(settings);
});

it('rejects bad codes, duplicates, a default outside the list and out-of-range rates', async () => {
  const bad = [
    { ...settings, currencies: [{ code: 'czk', decimals: 2 }] },
    { ...settings, currencies: [{ code: 'CZK', decimals: 2 }, { code: 'CZK', decimals: 0 }] },
    { ...settings, defaultCurrency: 'USD' },
    { ...settings, vatRates: [{ id: 'x', name: 'X', rate: 10001 }] },
    { ...settings, currencies: [{ code: 'CZK', decimals: 4 }] },
  ];
  for (const body of bad) expect((await request(app).put('/commerce/settings').send(body)).status).toBe(400);
});

it('refuses to remove a currency with prices or a VAT rate in use', async () => {
  await request(app).put('/commerce/settings').send(settings);
  const product = await ProductModel.create({ itemId: new mongoose.Types.ObjectId(), type: ProductType.PHYSICAL, vatRateId: 'standard' });
  await VariantModel.create({ productId: product._id, sku: 'TEE-M', prices: { CZK: 49000, EUR: 2000 } });

  const noEur = await request(app).put('/commerce/settings').send({ ...settings, currencies: [settings.currencies[0]] });
  expect(noEur.status).toBe(409);
  expect(noEur.body.error).toContain('EUR');
  const noStandard = await request(app).put('/commerce/settings').send({ ...settings, vatRates: [settings.vatRates[1]] });
  expect(noStandard.status).toBe(409);
  expect(noStandard.body.error).toContain('Standard');
  expect((await request(app).put('/commerce/settings').send({ ...settings, vatRates: [settings.vatRates[0]] })).status).toBe(200);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- settings.test`
Expected: FAIL, cannot find `./commerce.routes`.

- [ ] **Step 3: Implement**

`models/shop-settings.model.ts`:

```ts
import mongoose, { Schema, Document } from 'mongoose';

export interface ShopCurrency { code: string; decimals: number }
export interface VatRate { id: string; name: string; rate: number }

export interface IShopSettings extends Document {
  currencies: ShopCurrency[];
  defaultCurrency?: string;
  vatRates: VatRate[];
}

const ShopSettingsSchema = new Schema<IShopSettings>(
  {
    currencies: [{ _id: false, code: { type: String, required: true }, decimals: { type: Number, required: true } }],
    defaultCurrency: { type: String },
    vatRates: [{ _id: false, id: { type: String, required: true }, name: { type: String, required: true }, rate: { type: Number, required: true } }],
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const { _id, __v, createdAt, updatedAt, ...rest } = ret; void _id; void __v; void createdAt; void updatedAt; return rest; } },
  }
);

export const ShopSettingsModel = mongoose.model<IShopSettings>('ShopSettings', ShopSettingsSchema);
```

`models/product.model.ts`:

```ts
import mongoose, { Schema, Document } from 'mongoose';

export enum ProductType { PHYSICAL = 'PHYSICAL', DIGITAL = 'DIGITAL' }
export type Labels = Record<string, string>;
export interface ProductOptionValue { key: string; labels: Labels }
export interface ProductOption { key: string; labels: Labels; values: ProductOptionValue[] }
export interface DigitalFile { blobName: string; originalName: string; mimeType: string; size: number }

export interface IProduct extends Document {
  itemId: mongoose.Types.ObjectId;
  type: ProductType;
  vatRateId: string;
  active: boolean;
  options: ProductOption[];
  digitalFile?: DigitalFile;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OptionValueSchema = new Schema<ProductOptionValue>({ key: { type: String, required: true }, labels: { type: Schema.Types.Mixed, default: {} } }, { _id: false });
const OptionSchema = new Schema<ProductOption>({ key: { type: String, required: true }, labels: { type: Schema.Types.Mixed, default: {} }, values: [OptionValueSchema] }, { _id: false });

const ProductSchema = new Schema<IProduct>(
  {
    // Unique: one product per content item. The collection is new, so Cosmos DB accepts the index.
    itemId: { type: Schema.Types.ObjectId, required: true, unique: true },
    type: { type: String, enum: Object.values(ProductType), required: true },
    vatRateId: { type: String, required: true, index: true },
    active: { type: Boolean, default: false, index: true },
    options: { type: [OptionSchema], default: [] },
    digitalFile: { type: new Schema<DigitalFile>({ blobName: String, originalName: String, mimeType: String, size: Number }, { _id: false }) },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const { _id, __v, ...rest } = ret; void __v; return { id: _id.toString(), ...rest }; } },
  }
);
// Lists sort on one field each (Cosmos DB rule).
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ updatedAt: -1 });

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
```

`models/variant.model.ts`:

```ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IVariant extends Document {
  productId: mongoose.Types.ObjectId;
  sku: string;
  optionValues: Record<string, string>;
  prices: Record<string, number>;
  weightGrams: number;
  stock: { tracked: boolean; quantity: number };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<IVariant>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // Unique across the shop. The collection is new, so Cosmos DB accepts the index.
    sku: { type: String, required: true, trim: true, unique: true, maxlength: 64 },
    optionValues: { type: Schema.Types.Mixed, default: {} },
    prices: { type: Schema.Types.Mixed, default: {} },
    weightGrams: { type: Number, default: 0, min: 0 },
    stock: { tracked: { type: Boolean, default: false }, quantity: { type: Number, default: 0, min: 0 } },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: { transform: (_doc, ret) => { const { _id, __v, ...rest } = ret; void __v; return { id: _id.toString(), ...rest }; } },
  }
);
VariantSchema.index({ createdAt: 1 });

export const VariantModel = mongoose.model<IVariant>('Variant', VariantSchema);
```

`modules/commerce/commerce.schema.ts` (settings part; Tasks 3 and 4 add more):

```ts
import { z } from 'zod';

const currency = z.object({ code: z.string().regex(/^[A-Z]{3}$/), decimals: z.number().int().min(0).max(3) });
const vatRate = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(50),
  rate: z.number().int().min(0).max(10000),
});

export const settingsBody = z
  .object({ currencies: z.array(currency).max(20), defaultCurrency: z.string().optional(), vatRates: z.array(vatRate).max(20) })
  .superRefine((s, ctx) => {
    const codes = s.currencies.map((c) => c.code);
    if (new Set(codes).size !== codes.length) ctx.addIssue({ code: 'custom', path: ['currencies'], message: 'Currency codes must be unique' });
    const ids = s.vatRates.map((r) => r.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['vatRates'], message: 'VAT rate ids must be unique' });
    if (codes.length > 0 && (!s.defaultCurrency || !codes.includes(s.defaultCurrency)))
      ctx.addIssue({ code: 'custom', path: ['defaultCurrency'], message: 'Choose a default currency from the list' });
  });
export const settingsSchema = z.object({ body: settingsBody });
export type SettingsInput = z.infer<typeof settingsBody>;
```

`modules/commerce/settings.service.ts`:

```ts
import { ShopSettingsModel, type IShopSettings } from '../../models/shop-settings.model';
import { ProductModel } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import { AppError } from '../../middleware/error.middleware';
import type { SettingsInput } from './commerce.schema';

export class SettingsService {
  static async get(): Promise<IShopSettings> {
    return (await ShopSettingsModel.findOne()) ?? new ShopSettingsModel({ currencies: [], vatRates: [] });
  }

  static async assertReady(): Promise<IShopSettings> {
    const s = await SettingsService.get();
    if (s.currencies.length === 0 || s.vatRates.length === 0) throw new AppError('Add a currency and a VAT rate first', 409);
    return s;
  }

  static async replace(input: SettingsInput): Promise<IShopSettings> {
    const current = await SettingsService.get();
    for (const c of current.currencies) {
      if (input.currencies.some((n) => n.code === c.code)) continue;
      if (await VariantModel.exists({ [`prices.${c.code}`]: { $exists: true } })) {
        throw new AppError(`Currency ${c.code} has prices; remove them from the variants first`, 409);
      }
    }
    for (const r of current.vatRates) {
      if (input.vatRates.some((n) => n.id === r.id)) continue;
      if (await ProductModel.exists({ vatRateId: r.id })) throw new AppError(`VAT rate ${r.name} is used by products`, 409);
    }
    return ShopSettingsModel.findOneAndUpdate({}, { $set: input }, { upsert: true, new: true });
  }
}
```

Controller and routes (same style as `languages`): `GET /commerce/settings` returns `{ success: true, data: await SettingsService.get() }`; `PUT /commerce/settings` with `validate(settingsSchema)` returns the saved settings. Router uses `authMiddleware`. Mount in `routes/index.ts`: `router.use('/commerce', commerceRoutes)`.

(`toJSON` on the empty unsaved document gives `{ currencies: [], vatRates: [] }`, as the test expects.)

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): shop settings and commerce models"
```

---

## Task 2: The Product content model and its guards

**Files:**
- Create: `modules/commerce/product-model.ts`
- Modify: `models/content-type.model.ts` (`system`), `main.ts` (call `ensureProductModel()` after `migrateLanguages()`), `modules/content-types/content-types.service.ts` (delete and update guards), `modules/content-entries/content-entries.service.ts` (`deleteEntry` guard), `modules/languages/languages.service.ts` (`remove` guard)
- Test: `modules/commerce/product-model.test.ts`

**Interfaces:**
- Produces:
  - `IContentType.system?: 'product'`
  - `PRODUCT_CORE_FIELDS = ['name', 'description', 'images']`
  - `ensureProductModel(): Promise<IContentType>` (idempotent), `productContentTypeId(): Promise<mongoose.Types.ObjectId>` (calls `ensureProductModel` when missing)
  - Errors: `409` "The Product model cannot be deleted", "The Product model's name, description and images fields cannot be removed or changed", "This entry belongs to a product; delete it under Commerce", "N products have content only in <code>; translate or delete them first"

- [ ] **Step 1: Write the failing test** `modules/commerce/product-model.test.ts`

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import { useTestDb } from '../../test/db';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { LanguageModel } from '../../models/language.model';
import { FieldType } from '../../types/field-types';
import { contentTypesService } from '../content-types/content-types.service';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { LanguagesService } from '../languages/languages.service';
import { ensureProductModel } from './product-model';

useTestDb();

it('creates the Product model once, with translated name and description and shared images', async () => {
  const first = await ensureProductModel();
  const again = await ensureProductModel();
  expect(String(again._id)).toBe(String(first._id));
  expect(await ContentTypeModel.countDocuments({ system: 'product' })).toBe(1);
  expect(first).toMatchObject({ slug: 'product', titleField: 'name' });
  expect(first.fields.map((f) => [f.name, f.type])).toEqual([
    ['name', FieldType.TEXT],
    ['description', FieldType.RICH_TEXT],
    ['images', FieldType.MEDIA],
  ]);
});

it('cannot be deleted and keeps its core fields, but accepts new ones', async () => {
  const model = await ensureProductModel();
  await expect(contentTypesService.deleteContentType(String(model._id), { force: true })).rejects.toMatchObject({ statusCode: 409 });
  const without = model.fields.filter((f) => f.name !== 'images').map((f) => f.toObject?.() ?? f);
  await expect(contentTypesService.updateContentType(String(model._id), { fields: without })).rejects.toMatchObject({ statusCode: 409 });
  const retyped = model.fields.map((f) => ({ ...(f.toObject?.() ?? f), type: f.name === 'description' ? FieldType.TEXT : f.type }));
  await expect(contentTypesService.updateContentType(String(model._id), { fields: retyped })).rejects.toMatchObject({ statusCode: 409 });
  const extra = [...model.fields.map((f) => f.toObject?.() ?? f), { name: 'specs', label: 'Specifications', type: FieldType.RICH_TEXT, required: false }];
  const updated = await contentTypesService.updateContentType(String(model._id), { fields: extra });
  expect(updated?.fields.map((f) => f.name)).toContain('specs');
});

it('refuses to delete the last version of a product entry or the only language of one', async () => {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  const model = await ensureProductModel();
  const cs = await ContentEntriesService.createEntry({ contentTypeId: String(model._id), data: { name: 'Tričko' }, language: 'cs' });
  await expect(ContentEntriesService.deleteEntry(String(cs._id))).rejects.toMatchObject({ statusCode: 409 });
  await expect(LanguagesService.remove('cs', 'cs')).rejects.toMatchObject({ statusCode: 409 });
  expect(await ContentEntryModel.countDocuments({ _id: cs._id })).toBe(1);

  const en = await ContentEntriesService.createEntry({ contentTypeId: String(model._id), data: { name: 'T-shirt' }, itemId: String(cs.itemId) });
  expect(await ContentEntriesService.deleteEntry(String(cs._id))).toBe(true);
  expect(await ContentEntryModel.countDocuments({ _id: en._id })).toBe(1);
});
```

(Adjust how the test passes existing fields to `updateContentType` to the service's input type; the point is the three cases: remove a core field, change a core field's type, add a field.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- product-model`
Expected: FAIL, cannot find `./product-model`.

- [ ] **Step 3: Implement**

`models/content-type.model.ts`: add `system?: 'product';` to `IContentType` and `system: { type: String, enum: ['product'], index: true },` to the schema.

`modules/commerce/product-model.ts`:

```ts
import mongoose from 'mongoose';
import { ContentTypeModel, type IContentType } from '../../models/content-type.model';
import { FieldType } from '../../types/field-types';

export const PRODUCT_CORE_FIELDS = ['name', 'description', 'images'] as const;

const CORE_FIELDS = [
  { name: 'name', label: 'Name', type: FieldType.TEXT, required: true },
  { name: 'description', label: 'Description', type: FieldType.RICH_TEXT, required: false },
  { name: 'images', label: 'Images', type: FieldType.MEDIA, required: false, validation: { multiple: true } },
];

/** Idempotent: the system content type that holds product text and images. */
export async function ensureProductModel(): Promise<IContentType> {
  const existing = await ContentTypeModel.findOne({ system: 'product' });
  if (existing) return existing;
  // A user model may already use the slug "product"; the system model then takes "shop-product".
  const slug = (await ContentTypeModel.exists({ slug: 'product' })) ? 'shop-product' : 'product';
  return ContentTypeModel.create({ name: 'Product', slug, system: 'product', titleField: 'name', fields: CORE_FIELDS });
}

export async function productContentTypeId(): Promise<mongoose.Types.ObjectId> {
  return (await ensureProductModel())._id as mongoose.Types.ObjectId;
}
```

(Check the field schema's required properties and `validation.multiple` in `models/content-type.model.ts`; `TEXT`/`RICH_TEXT` are translated and `MEDIA` shared by default, as spec 4.4 wants.)

Guards:

- `content-types.service.ts` `deleteContentType`: at the start, load the type's `system`; if `'product'`, `throw new AppError('The Product model cannot be deleted', 409)`.
- `updateContentType`: when the type is the product model and `data.fields` is set, every core field must still exist with the same type: otherwise `throw new AppError("The Product model's name, description and images fields cannot be removed or changed", 409)`. Also ignore any `system` key in `data` (it is not in the Zod schema; make sure it cannot be set through the API).
- `content-entries.service.ts` `deleteEntry`: after loading the entry, if its content type has `system: 'product'` and `ContentEntryModel.countDocuments({ itemId: entry.itemId }) === 1`, `throw new AppError('This entry belongs to a product; delete it under Commerce', 409)`.
- `languages.service.ts` `remove`: before deleting, count product items whose only versions are in `code`:

```ts
    const productType = await ContentTypeModel.findOne({ system: 'product' }).select('_id').lean();
    if (productType) {
      const inLanguage = await ContentEntryModel.distinct('itemId', { contentTypeId: productType._id, language: code });
      const elsewhere = await ContentEntryModel.distinct('itemId', { itemId: { $in: inLanguage }, language: { $ne: code } });
      const only = inLanguage.length - elsewhere.length;
      if (only > 0) throw new AppError(`${only} products have content only in ${code}; translate or delete them first`, 409);
    }
```

- `main.ts`: after the languages migration, `await ensureProductModel();`.

Check that each controller passes these `AppError`s to `next(error)` (the content type and entry controllers map some messages themselves; an `AppError` with `statusCode` must reach `errorMiddleware` unchanged). Add a supertest case for `DELETE /content-types/:id` returning `409` if a controller swallows it.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): system Product content model and its guards"
```

---

## Task 3: Products and variants

**Files:**
- Create: `modules/commerce/products.service.ts`, `modules/commerce/variants.service.ts`
- Modify: `modules/commerce/commerce.schema.ts`, `commerce.controller.ts`, `commerce.routes.ts`
- Test: `modules/commerce/products.test.ts`

**Interfaces:**
- Consumes: `SettingsService.assertReady`, models (Task 1), `productContentTypeId`, `PRODUCT_CORE_FIELDS` (Task 2), `ContentEntriesService.createEntry`, `LanguagesService.defaultCode/codes`.
- Produces:
  - `ProductsService.create({ name, type, userId? }): Promise<ProductDetail>`
  - `ProductsService.list({ page, limit, search?, type?, status?: 'active' | 'inactive' | 'unpublished', sortBy?: 'createdAt' | 'updatedAt', sortOrder? }): Promise<{ products: ProductListItem[]; pagination }>`
  - `ProductsService.get(id): Promise<ProductDetail>` (404)
  - `ProductsService.update(id, { vatRateId?, active?, options? }): Promise<ProductDetail>` (options change regenerates variants; returns `removedVariantIds`)
  - `ProductsService.remove(id): Promise<void>`
  - `VariantsService.replaceAll(productId, variants: VariantInput[]): Promise<IVariant[]>` (bulk save of the table)
  - `ProductDetail = { product: IProduct JSON; variants: IVariant JSON[]; entry: { itemId, defaultVersionId, name } }`
  - `ProductListItem = { id, itemId, type, active, name, published: boolean, variantsCount, priceRange: { min, max } | null, stock: 'out' | 'low' | null }`
  - Routes: `GET/POST /commerce/products`, `GET/PUT/DELETE /commerce/products/:id`, `PUT /commerce/products/:id/variants`

- [ ] **Step 1: Write the failing test** `modules/commerce/products.test.ts`

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { LanguageModel } from '../../models/language.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { ProductModel } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import { SettingsService } from './settings.service';
import commerceRoutes from './commerce.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/commerce', commerceRoutes);
app.use(errorMiddleware);

async function ready() {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  await SettingsService.replace({
    currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
    defaultCurrency: 'CZK',
    vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }],
  });
}

const sizes = [{ key: 'size', labels: { en: 'Size', cs: 'Velikost' }, values: [{ key: 's', labels: { en: 'S' } }, { key: 'm', labels: { en: 'M' } }] }];

it('needs settings before the first product', async () => {
  await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
  expect((await request(app).post('/commerce/products').send({ name: 'T-shirt', type: 'PHYSICAL' })).status).toBe(409);
});

it('creates a product with its draft entry and one variant, and deletes them together', async () => {
  await ready();
  const created = await request(app).post('/commerce/products').send({ name: 'Bike T-shirt', type: 'PHYSICAL' });
  expect(created.status).toBe(201);
  const { product, variants, entry } = created.body.data;
  expect(product).toMatchObject({ type: 'PHYSICAL', active: false, vatRateId: 'standard', options: [] });
  expect(variants).toHaveLength(1);
  expect(variants[0].sku).toBe('BIKE-T-SHIRT');
  expect(entry.name).toBe('Bike T-shirt');
  expect(await ContentEntryModel.countDocuments({ itemId: entry.itemId, language: 'en', status: 'DRAFT' })).toBe(1);

  expect((await request(app).delete(`/commerce/products/${product.id}`)).status).toBe(200);
  expect(await ProductModel.countDocuments()).toBe(0);
  expect(await VariantModel.countDocuments()).toBe(0);
  expect(await ContentEntryModel.countDocuments({ itemId: entry.itemId })).toBe(0);
});

it('regenerates variants when options change, keeping existing combinations', async () => {
  await ready();
  const { product } = (await request(app).post('/commerce/products').send({ name: 'Tee', type: 'PHYSICAL' })).body.data;
  const first = await request(app).put(`/commerce/products/${product.id}`).send({ options: sizes });
  expect(first.status).toBe(200);
  expect(first.body.data.variants.map((v: { optionValues: Record<string, string> }) => v.optionValues.size).sort()).toEqual(['m', 's']);
  const sId = first.body.data.variants.find((v: { optionValues: { size: string } }) => v.optionValues.size === 's').id;

  const onlyS = [{ ...sizes[0], values: [sizes[0].values[0]] }];
  const second = await request(app).put(`/commerce/products/${product.id}`).send({ options: onlyS });
  expect(second.body.data.variants.map((v: { id: string }) => v.id)).toEqual([sId]);
  expect(second.body.data.removedVariantIds).toHaveLength(1);
});

it('rejects option labels without the default language and more than 3 options', async () => {
  await ready();
  const { product } = (await request(app).post('/commerce/products').send({ name: 'Tee', type: 'PHYSICAL' })).body.data;
  const noEn = [{ key: 'size', labels: { cs: 'Velikost' }, values: [{ key: 's', labels: { en: 'S' } }] }];
  expect((await request(app).put(`/commerce/products/${product.id}`).send({ options: noEn })).status).toBe(400);
  const four = ['a', 'b', 'c', 'd'].map((k) => ({ key: k, labels: { en: k }, values: [{ key: 'x', labels: { en: 'x' } }] }));
  expect((await request(app).put(`/commerce/products/${product.id}`).send({ options: four })).status).toBe(400);
});

it('saves the variants table and refuses duplicate SKUs within and across products', async () => {
  await ready();
  const a = (await request(app).post('/commerce/products').send({ name: 'Tee', type: 'PHYSICAL' })).body.data;
  const b = (await request(app).post('/commerce/products').send({ name: 'Cap', type: 'PHYSICAL' })).body.data;
  const row = { ...a.variants[0], sku: 'TEE-1', prices: { CZK: 49000, EUR: 2000 }, weightGrams: 180, stock: { tracked: true, quantity: 4 } };
  const saved = await request(app).put(`/commerce/products/${a.product.id}/variants`).send({ variants: [row] });
  expect(saved.status).toBe(200);
  expect(saved.body.data[0]).toMatchObject({ sku: 'TEE-1', prices: { CZK: 49000, EUR: 2000 }, stock: { tracked: true, quantity: 4 } });

  const clash = await request(app).put(`/commerce/products/${b.product.id}/variants`).send({ variants: [{ ...b.variants[0], sku: 'TEE-1' }] });
  expect(clash.status).toBe(409);
  expect(clash.body.error).toContain('TEE-1');
  expect((await request(app).put(`/commerce/products/${a.product.id}/variants`).send({ variants: [row, { ...row, id: undefined }] })).status).toBe(400);
  expect((await request(app).put(`/commerce/products/${a.product.id}/variants`).send({ variants: [{ ...row, prices: { USD: 100 } }] })).status).toBe(400);
});

it('lists products with name, price range, stock and status, and finds them by SKU', async () => {
  await ready();
  const a = (await request(app).post('/commerce/products').send({ name: 'Tee', type: 'PHYSICAL' })).body.data;
  await request(app).put(`/commerce/products/${a.product.id}/variants`).send({ variants: [{ ...a.variants[0], sku: 'TEE-1', prices: { CZK: 49000 }, stock: { tracked: true, quantity: 0 } }] });
  await request(app).post('/commerce/products').send({ name: 'Guide', type: 'DIGITAL' });
  const list = await request(app).get('/commerce/products');
  expect(list.body.pagination.total).toBe(2);
  const tee = list.body.data.find((p: { name: string }) => p.name === 'Tee');
  expect(tee).toMatchObject({ type: 'PHYSICAL', active: false, published: false, variantsCount: 1, priceRange: { min: 49000, max: 49000 }, stock: 'out' });
  const bySku = await request(app).get('/commerce/products').query({ search: 'tee-1' });
  expect(bySku.body.data.map((p: { name: string }) => p.name)).toEqual(['Tee']);
  expect((await request(app).get('/commerce/products').query({ type: 'DIGITAL' })).body.data.map((p: { name: string }) => p.name)).toEqual(['Guide']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- products.test`
Expected: FAIL: 404 on `/commerce/products`.

- [ ] **Step 3: Implement**

`commerce.schema.ts` additions:

```ts
const KEY = /^[a-z][a-z0-9-]{0,39}$/;
const labels = z.record(z.string().trim().min(1).max(100));
const optionValue = z.object({ key: z.string().regex(KEY), labels });
const option = z.object({ key: z.string().regex(KEY), labels, values: z.array(optionValue).min(1).max(50) });

export const createProductSchema = z.object({
  body: z.object({ name: z.string().trim().min(1).max(200), type: z.enum(['PHYSICAL', 'DIGITAL']) }),
});
export const updateProductSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    vatRateId: z.string().optional(),
    active: z.boolean().optional(),
    options: z.array(option).max(3).optional(),
  }),
});
const variantInput = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1).max(64),
  optionValues: z.record(z.string()).default({}),
  prices: z.record(z.number().int().min(0)).default({}),
  weightGrams: z.number().int().min(0).default(0),
  stock: z.object({ tracked: z.boolean(), quantity: z.number().int().min(0) }).default({ tracked: false, quantity: 0 }),
  active: z.boolean().default(true),
});
export const variantsSchema = z.object({ params: z.object({ id: z.string() }), body: z.object({ variants: z.array(variantInput).min(1).max(500) }) });
export type VariantInput = z.infer<typeof variantInput>;
export type ProductOptionInput = z.infer<typeof option>;
export const listProductsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    type: z.enum(['PHYSICAL', 'DIGITAL']).optional(),
    status: z.enum(['active', 'inactive', 'unpublished']).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});
```

Service-level rules that Zod cannot see (all `AppError`):
- Option keys unique; value keys unique within an option; each option's and value's `labels` has the default language (`LanguagesService.defaultCode()`) and only configured codes: `400`.
- `vatRateId` must exist in settings: `400`.
- Variants: unique `sku` within the request (`400`), no SKU used by another product (`409` "SKU TEE-1 is already used"), unique `optionValues` combination, `optionValues` keys equal the product's option keys and values exist (`400`), price currencies are configured (`400`), `weightGrams` forced to 0 and `stock.tracked` to false for `DIGITAL`.

`products.service.ts` core:

```ts
import mongoose from 'mongoose';
import { ProductModel, ProductType, type IProduct, type ProductOption } from '../../models/product.model';
import { VariantModel, type IVariant } from '../../models/variant.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { AppError } from '../../middleware/error.middleware';
import { escapeRegex } from '../../utils/regex';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { LanguagesService } from '../languages/languages.service';
import { SettingsService } from './settings.service';
import { productContentTypeId } from './product-model';
import { deleteDigitalFile } from './digital-files';

export function skuFromName(name: string): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (base || 'PRODUCT').slice(0, 56);
}

async function uniqueSku(base: string): Promise<string> {
  let sku = base;
  for (let n = 2; await VariantModel.exists({ sku }); n++) sku = `${base}-${n}`;
  return sku;
}

/** Every combination of option values, as { optionKey: valueKey }. */
export function combinations(options: ProductOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((combo) => o.values.map((v) => ({ ...combo, [o.key]: v.key }))),
    [{}]
  );
}

const sameCombo = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);
```

- `create`: `const settings = await SettingsService.assertReady()`; create the entry with `ContentEntriesService.createEntry({ contentTypeId: String(await productContentTypeId()), data: { name }, createdBy: userId })`; create the product `{ itemId: entry.itemId, type, vatRateId: settings.vatRates[0].id, active: false }`; create one variant `{ sku: await uniqueSku(skuFromName(name)) }`. If the product or variant insert fails, delete what was created (entry, product) and rethrow.
- `update` with `options`: validate (rules above); compute `combinations(options)`; keep variants whose `optionValues` match a combination (compare after dropping keys of removed options when an option was removed entirely: a variant `{ size: 's', color: 'blue' }` matches `{ size: 's' }` only if `color` was removed), create missing combinations with prices copied from the first kept variant (or the first existing variant) and `stock: { tracked: product.type === 'PHYSICAL', quantity: 0 }`, SKU `${firstSku}-${valueKeys.join('-').toUpperCase()}` made unique; delete the rest; return `{ ...detail, removedVariantIds }`.
- `remove`: load the product, `deleteMany` its variants, delete the product, delete every entry version (`ContentEntryModel.deleteMany({ itemId })`), then `deleteDigitalFile(product)` (Task 4; until then a no-op export in `digital-files.ts`).
- `list`: build the product filter:
  - `type` filter as is; `status: 'active' | 'inactive'` on `active`; `'unpublished'` means `itemId` not in `ContentEntryModel.distinct('itemId', { contentTypeId, status: PUBLISHED })`.
  - `search`: `$or` of `itemId $in distinct('itemId', { contentTypeId, title: regex })` and `_id $in VariantModel.distinct('productId', { sku: regex })` (regex from `escapeRegex`, case-insensitive).
  - `find(filter).sort({ [sortBy]: dir }).skip.limit` and `countDocuments(filter)`.
  - For the page: variants `$in` product ids, entries `$in` item ids (default-language version first for `name`, else any), published item ids; compute `priceRange` in the default currency (null when no variant has one), `stock` ('out' when every tracked active variant has 0 and at least one is tracked; 'low' when some tracked variant has 1 to 5; else null).
- `get`: product, its variants sorted by `createdAt` (single-field index), the entry summary.

`variants.service.ts` `replaceAll`: validate, then within the product: update rows with `id`, insert rows without `id`, delete product variants not in the request. Catch duplicate-key errors (`code === 11000`) from a race and turn them into the same `409`.

Controller and routes: list, create (201), get, update, delete (`{ success: true, data: null }`), variants. The create passes `(req as any).user?.userId`.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): products and variants"
```

---

## Task 4: Private digital files

**Files:**
- Create: `modules/commerce/digital-files.ts` (replace the Task 3 stub), `modules/commerce/digital-files.test.ts`
- Modify: `config/storage.ts` (private container), `config/upload.ts` (`digitalUpload`), `commerce.routes.ts`, `commerce.controller.ts`

**Interfaces:**
- Produces:
  - `storageService.uploadPrivateFile(blobName, filePath, mimeType): Promise<void>`, `storageService.deletePrivateFile(blobName): Promise<boolean>`
  - `digitalUpload` (multer, disk storage in `os.tmpdir()`, 500 MB, single field `file`)
  - `uploadDigitalFile(productId, file: Express.Multer.File): Promise<DigitalFile>` (replaces the old blob), `deleteDigitalFile(product: IProduct): Promise<void>` (logs failures, never throws)
  - Route `POST /commerce/products/:id/file` (multipart, field `file`)

- [ ] **Step 1: Write the failing test** `modules/commerce/digital-files.test.ts`

```ts
jest.mock('../../config/storage', () => ({
  storageService: { uploadPrivateFile: jest.fn().mockResolvedValue(undefined), deletePrivateFile: jest.fn().mockResolvedValue(true) },
}));
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { storageService } from '../../config/storage';
import { LanguageModel } from '../../models/language.model';
import { ProductModel } from '../../models/product.model';
import { SettingsService } from './settings.service';
import commerceRoutes from './commerce.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/commerce', commerceRoutes);
app.use(errorMiddleware);

async function product(type: 'PHYSICAL' | 'DIGITAL') {
  await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
  await SettingsService.replace({ currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }] });
  return (await request(app).post('/commerce/products').send({ name: 'Šumava GPX guide', type })).body.data.product;
}

it('uploads a digital file privately and replaces the previous one', async () => {
  const p = await product('DIGITAL');
  const first = await request(app).post(`/commerce/products/${p.id}/file`).attach('file', Buffer.from('<gpx/>'), { filename: 'sumava.gpx', contentType: 'application/gpx+xml' });
  expect(first.status).toBe(200);
  expect(first.body.data).toMatchObject({ originalName: 'sumava.gpx', mimeType: 'application/gpx+xml', size: 6 });
  expect(first.body.data).not.toHaveProperty('url');
  const blob = first.body.data.blobName;
  await request(app).post(`/commerce/products/${p.id}/file`).attach('file', Buffer.from('<gpx>2</gpx>'), { filename: 'v2.gpx', contentType: 'application/gpx+xml' });
  expect(storageService.deletePrivateFile).toHaveBeenCalledWith(blob);
  expect((await ProductModel.findById(p.id).lean())?.digitalFile?.originalName).toBe('v2.gpx');
});

it('refuses files for physical products', async () => {
  const p = await product('PHYSICAL');
  const res = await request(app).post(`/commerce/products/${p.id}/file`).attach('file', Buffer.from('x'), { filename: 'x.pdf', contentType: 'application/pdf' });
  expect(res.status).toBe(400);
});

it('deletes the product even when the blob cannot be deleted', async () => {
  const p = await product('DIGITAL');
  await request(app).post(`/commerce/products/${p.id}/file`).attach('file', Buffer.from('<gpx/>'), { filename: 'a.gpx', contentType: 'application/gpx+xml' });
  jest.mocked(storageService.deletePrivateFile).mockRejectedValueOnce(new Error('storage down'));
  expect((await request(app).delete(`/commerce/products/${p.id}`)).status).toBe(200);
  expect(await ProductModel.countDocuments()).toBe(0);
});

```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- digital-files`
Expected: FAIL: 404 on the upload route.

- [ ] **Step 3: Implement**

`config/storage.ts`: read `AZURE_STORAGE_PRIVATE_CONTAINER_NAME` (default `downloads`); in `initialize()` also get and create the private container **without** an `access` option (private). Add:

```ts
  async uploadPrivateFile(blobName: string, filePath: string, mimeType: string): Promise<void> {
    const blob = this.getPrivateContainerClient().getBlockBlobClient(blobName);
    await blob.uploadFile(filePath, { blobHTTPHeaders: { blobContentType: mimeType } });
  }

  async deletePrivateFile(blobName: string): Promise<boolean> {
    await this.getPrivateContainerClient().getBlockBlobClient(blobName).deleteIfExists();
    return true;
  }
```

`config/upload.ts`:

```ts
export const MAX_DIGITAL_FILE_SIZE = 500 * 1024 * 1024;

/** Digital products: streamed from disk to the private container, never held in memory. */
export const digitalUpload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: MAX_DIGITAL_FILE_SIZE },
});
```

`digital-files.ts`:

```ts
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { storageService } from '../../config/storage';
import { ProductModel, ProductType, type DigitalFile, type IProduct } from '../../models/product.model';
import { AppError } from '../../middleware/error.middleware';

export async function uploadDigitalFile(productId: string, file: Express.Multer.File): Promise<DigitalFile> {
  try {
    const product = await ProductModel.findById(productId);
    if (!product) throw new AppError('Product not found', 404);
    if (product.type !== ProductType.DIGITAL) throw new AppError('Only digital products have a file', 400);
    const blobName = `products/${productId}/${crypto.randomUUID()}`;
    await storageService.uploadPrivateFile(blobName, file.path, file.mimetype);
    const previous = product.digitalFile?.blobName;
    product.digitalFile = { blobName, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
    await product.save();
    if (previous) await storageService.deletePrivateFile(previous).catch((err) => console.error('Old digital file not deleted:', err));
    return product.digitalFile;
  } finally {
    await fs.unlink(file.path).catch(() => undefined);
  }
}

export async function deleteDigitalFile(product: Pick<IProduct, 'digitalFile'>): Promise<void> {
  if (!product.digitalFile?.blobName) return;
  await storageService.deletePrivateFile(product.digitalFile.blobName).catch((err) => console.error('Digital file not deleted:', err));
}
```

Route: `router.post('/products/:id/file', digitalUpload.single('file'), controller.uploadFile)`; a missing file returns `400`; multer's `LIMIT_FILE_SIZE` error returns `400` "Files up to 500 MB" (map it in the controller or a small error handler on the router). The upload response is `{ success: true, data: digitalFile }`.

Product JSON never includes a URL for the file (the stored fields are `blobName`, `originalName`, `mimeType`, `size`); Plan 2 shows name and size only.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): private files for digital products"
```

---

## Task 5: Public shop API

**Files:**
- Create: `modules/commerce/public-shop.service.ts`, `modules/commerce/public-shop.test.ts`
- Modify: `modules/public/public.controller.ts`, `modules/public/public.routes.ts`

**Interfaces:**
- Consumes: `SettingsService.get`, `LanguagesService` (`assertExists`, `defaultCode`), models, `productContentTypeId`, `resolveLanguage` from `modules/public/public-content.service.ts`.
- Produces:
  - `resolveCurrency(requested?: unknown): Promise<string>` (`400` "Unknown currency 'USD'. Use one of: CZK, EUR")
  - `listShopProducts({ currency, language, defaultLanguage, page, limit, ids? }): Promise<{ products: PublicProduct[]; pagination }>`
  - `getShopProduct(id, currency, language, defaultLanguage): Promise<PublicProduct | null>`
  - Routes: `GET /public/shop/settings`, `GET /public/shop/products`, `GET /public/shop/products/:id`

- [ ] **Step 1: Write the failing test** `modules/commerce/public-shop.test.ts`

```ts
jest.mock('../../middleware/apiKey.middleware', () => ({ apiKeyMiddleware: (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { LanguageModel } from '../../models/language.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { ProductModel } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { SettingsService } from './settings.service';
import { ProductsService } from './products.service';
import publicRoutes from '../public/public.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/public', publicRoutes);
app.use(errorMiddleware);

async function seed() {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  await SettingsService.replace({
    currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
    defaultCurrency: 'CZK',
    vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }],
  });
  const tee = await ProductsService.create({ name: 'Bike T-shirt', type: 'PHYSICAL' as never });
  await ProductsService.update(tee.product.id, {
    active: true,
    options: [{ key: 'size', labels: { en: 'Size', cs: 'Velikost' }, values: [{ key: 's', labels: { en: 'S' } }, { key: 'm', labels: { en: 'M' } }] }],
  });
  const variants = await VariantModel.find({ productId: tee.product.id });
  for (const v of variants) {
    v.prices = v.optionValues.size === 's' ? { CZK: 49000, EUR: 2000 } : { CZK: 52000 };
    v.stock = { tracked: true, quantity: v.optionValues.size === 's' ? 3 : 0 };
    await v.save();
  }
  await ContentEntryModel.updateMany({ itemId: tee.entry.itemId }, { $set: { status: ContentStatus.PUBLISHED, publishedAt: new Date() } });
  await ContentEntriesService.createEntry({ contentTypeId: String((await ContentEntryModel.findOne({ itemId: tee.entry.itemId }))!.contentTypeId), data: { name: 'Cyklistické tričko' }, language: 'cs', itemId: tee.entry.itemId, status: ContentStatus.PUBLISHED });

  const hidden = await ProductsService.create({ name: 'Draft cap', type: 'PHYSICAL' as never });
  await ProductsService.update(hidden.product.id, { active: true });
  await VariantModel.updateMany({ productId: hidden.product.id }, { $set: { prices: { CZK: 30000 } } });
  return { tee };
}

it('lists products for sale in the default currency and language', async () => {
  await seed();
  const res = await request(app).get('/public/shop/products');
  expect(res.status).toBe(200);
  expect(res.body.pagination.total).toBe(1);
  const [p] = res.body.data;
  expect(p).toMatchObject({ type: 'PHYSICAL', currency: 'CZK', priceRange: { min: 49000, max: 52000 } });
  expect(p.content).toMatchObject({ language: 'en', fallback: false, data: { name: 'Bike T-shirt' } });
  expect(p.options).toEqual([{ key: 'size', label: 'Size', values: [{ key: 's', label: 'S' }, { key: 'm', label: 'M' }] }]);
  const m = p.variants.find((v: { optionValues: { size: string } }) => v.optionValues.size === 'm');
  expect(m).toMatchObject({ price: 52000, vatRate: 2100, available: false, availableQuantity: 0 });
});

it('uses the requested language for content and labels, with fallback for labels', async () => {
  await seed();
  const [p] = (await request(app).get('/public/shop/products').query({ language: 'cs' })).body.data;
  expect(p.content).toMatchObject({ language: 'cs', data: { name: 'Cyklistické tričko' } });
  expect(p.options[0]).toMatchObject({ label: 'Velikost', values: [{ key: 's', label: 'S' }, { key: 'm', label: 'M' }] });
});

it('leaves out variants without a price in the requested currency', async () => {
  await seed();
  const [p] = (await request(app).get('/public/shop/products').query({ currency: 'EUR' })).body.data;
  expect(p.variants.map((v: { optionValues: { size: string } }) => v.optionValues.size)).toEqual(['s']);
  expect(p.priceRange).toEqual({ min: 2000, max: 2000 });
});

it('rejects an unknown currency or language', async () => {
  await seed();
  const usd = await request(app).get('/public/shop/products').query({ currency: 'USD' });
  expect(usd.status).toBe(400);
  expect(usd.body.error).toContain('CZK, EUR');
  expect((await request(app).get('/public/shop/products').query({ language: 'xx' })).status).toBe(400);
});

it('returns one product by product id or entry id, and 404 when not for sale', async () => {
  const { tee } = await seed();
  expect((await request(app).get(`/public/shop/products/${tee.product.id}`)).body.data.id).toBe(tee.product.id);
  expect((await request(app).get(`/public/shop/products/${tee.entry.itemId}`)).body.data.id).toBe(tee.product.id);
  await ProductModel.updateOne({ _id: tee.product.id }, { $set: { active: false } });
  expect((await request(app).get(`/public/shop/products/${tee.product.id}`)).status).toBe(404);
});

it('serves shop settings', async () => {
  await seed();
  expect((await request(app).get('/public/shop/settings')).body.data).toEqual({
    currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
    defaultCurrency: 'CZK',
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- public-shop`
Expected: FAIL: 404.

- [ ] **Step 3: Implement** `modules/commerce/public-shop.service.ts`

```ts
import mongoose from 'mongoose';
import { ProductModel, type IProduct, type Labels } from '../../models/product.model';
import { VariantModel, type IVariant } from '../../models/variant.model';
import { ContentEntryModel, ContentStatus, type IContentEntry } from '../../models/content-entry.model';
import { AppError } from '../../middleware/error.middleware';
import { SettingsService } from './settings.service';
import { productContentTypeId } from './product-model';

export async function resolveCurrency(requested?: unknown): Promise<string> {
  const settings = await SettingsService.get();
  const codes = settings.currencies.map((c) => c.code);
  if (typeof requested !== 'string' || requested.trim() === '') return settings.defaultCurrency ?? codes[0] ?? '';
  const code = requested.trim().toUpperCase();
  if (!codes.includes(code)) throw new AppError(`Unknown currency '${code}'. Use one of: ${codes.join(', ')}`, 400);
  return code;
}

const label = (labels: Labels | undefined, language: string, defaultLanguage: string) =>
  labels?.[language] ?? labels?.[defaultLanguage] ?? Object.values(labels ?? {})[0] ?? '';

/** Published version per item: the requested language, else the default language. */
async function contentFor(itemIds: mongoose.Types.ObjectId[], language: string, defaultLanguage: string) {
  const versions = await ContentEntryModel.find({ itemId: { $in: itemIds }, status: ContentStatus.PUBLISHED, language: { $in: [language, defaultLanguage] } }).exec();
  const byItem = new Map<string, IContentEntry>();
  for (const v of versions) {
    const key = String(v.itemId);
    const current = byItem.get(key);
    if (!current || (current.language !== language && v.language === language)) byItem.set(key, v);
  }
  return byItem;
}

function toPublic(product: IProduct, variants: IVariant[], entry: IContentEntry, currency: string, vatRate: number, language: string, defaultLanguage: string) {
  const sellable = variants.filter((v) => v.active && typeof v.prices?.[currency] === 'number');
  const prices = sellable.map((v) => v.prices[currency]);
  return {
    id: String(product._id),
    type: product.type,
    itemId: String(product.itemId),
    currency,
    content: { ...entry.toJSON(), language: entry.language, fallback: entry.language !== language },
    options: product.options.map((o) => ({
      key: o.key,
      label: label(o.labels, language, defaultLanguage),
      values: o.values.map((v) => ({ key: v.key, label: label(v.labels, language, defaultLanguage) })),
    })),
    variants: sellable.map((v) => ({
      id: String(v._id),
      sku: v.sku,
      optionValues: v.optionValues,
      price: v.prices[currency],
      vatRate,
      available: !v.stock?.tracked || v.stock.quantity > 0,
      availableQuantity: v.stock?.tracked ? v.stock.quantity : null,
    })),
    priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  };
}
```

- `listShopProducts`:
  1. `typeId = await productContentTypeId()`; `published = ContentEntryModel.distinct('itemId', { contentTypeId: typeId, status: PUBLISHED })`; `priced = VariantModel.distinct('productId', { active: true, [`prices.${currency}`]: { $exists: true } })`.
  2. Filter `{ active: true, _id: { $in: priced }, itemId: { $in: published } }`, narrowed by `ids` (each id matches `_id` or `itemId`; also resolve version ids through `ContentEntryModel.distinct('itemId', { _id: { $in: ids } })`).
  3. `find(filter).sort({ createdAt: -1 }).skip.limit` and `countDocuments(filter)`.
  4. Load the page's variants (`productId $in`), content (`contentFor`), settings (VAT rate by `vatRateId`, 0 when missing), map with `toPublic`.
- `getShopProduct(id, ...)`: find by `_id`, else by `itemId`, else via a version's `itemId`; then apply the same rules; `null` when not for sale (inactive, no published content, no sellable variant).
- Controller: `resolveLanguage(req.query.language)` from `public-content.service.ts` and `resolveCurrency(req.query.currency)`; `page`/`limit` like the content list (limit max 100); `ids` split on commas, max 100, invalid ObjectIds ignored. Settings endpoint returns `{ currencies, defaultCurrency }` only.
- Routes in `public.routes.ts` next to the content routes, behind the same `publicApiLimiter` and `apiKeyMiddleware`, with swagger comments in the file's style.

Add to `test/cosmos-sort-indexes.test.ts`: the admin products list (`ProductsService.list({ sortBy: 'createdAt' })` and `'updatedAt'`), the public list (`listShopProducts`) and the variants of `ProductsService.get` are served by declared indexes.

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): public shop API"
```

---

## Task 6: Webhooks

**Files:**
- Modify: `models/webhook.model.ts`, `modules/commerce/products.service.ts`, `modules/commerce/variants.service.ts`, `modules/commerce/digital-files.ts`
- Test: `modules/commerce/commerce-webhooks.test.ts`

**Interfaces:**
- Produces: `WebhookEvent.PRODUCT_UPDATED = 'product.updated'`, `PRODUCT_DELETED = 'product.deleted'`, `STOCK_CHANGED = 'stock.changed'`. Payload `{ product: { id, itemId, type, active }, variantIds: string[] }`.

- [ ] **Step 1: Write the failing test** `modules/commerce/commerce-webhooks.test.ts`

```ts
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import { useTestDb } from '../../test/db';
import { WebhookService } from '../../services/webhook.service';
import { LanguageModel } from '../../models/language.model';
import { SettingsService } from './settings.service';
import { ProductsService } from './products.service';
import { VariantsService } from './variants.service';

useTestDb();

beforeEach(async () => {
  await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
  await SettingsService.replace({ currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }] });
});

it('sends product.updated, stock.changed only when a quantity changes, and product.deleted', async () => {
  const p = await ProductsService.create({ name: 'Tee', type: 'PHYSICAL' as never });
  const triggered = jest.mocked(WebhookService.triggerEvent);
  triggered.mockClear();

  await ProductsService.update(p.product.id, { active: true });
  expect(triggered).toHaveBeenCalledWith('product.updated', expect.objectContaining({ product: expect.objectContaining({ id: p.product.id, active: true }) }));

  triggered.mockClear();
  const row = { ...p.variants[0], stock: { tracked: true, quantity: 5 } };
  await VariantsService.replaceAll(p.product.id, [row]);
  expect(triggered).toHaveBeenCalledWith('stock.changed', expect.objectContaining({ variantIds: [p.variants[0].id] }));

  triggered.mockClear();
  await VariantsService.replaceAll(p.product.id, [{ ...row, prices: { CZK: 100 } }]);
  expect(triggered.mock.calls.map((c) => c[0])).toEqual(['product.updated']);

  triggered.mockClear();
  await ProductsService.remove(p.product.id);
  expect(triggered).toHaveBeenCalledWith('product.deleted', expect.objectContaining({ product: expect.objectContaining({ id: p.product.id }) }));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/backend && pnpm test -- commerce-webhooks`
Expected: FAIL: no `product.updated` call.

- [ ] **Step 3: Implement**

Add the three events to `WebhookEvent` (the webhooks Zod schema uses `z.nativeEnum`, so they become subscribable). In the services, after a successful write, `WebhookService.triggerEvent(event, payload).catch((err) => console.error('Webhook trigger error:', err))`:
- `ProductsService.update` and `uploadDigitalFile`: `product.updated` with `variantIds` of created and removed variants (empty otherwise).
- `VariantsService.replaceAll`: `product.updated` with all saved variant ids; additionally `stock.changed` with the ids whose `stock.quantity` or `stock.tracked` differs from before.
- `ProductsService.remove`: `product.deleted` with the removed variant ids.
- `ProductsService.create`: `product.updated` (the entry's own `entry.created` fires as today).

- [ ] **Step 4: Run tests and build; commit**

Run: `cd packages/backend && pnpm test && pnpm build`
Expected: PASS.

```bash
git add -A packages/backend
git commit -m "feat(backend): product and stock webhooks"
```

---

## Task 7: Local verification

**Files:** none unless a defect is found (fix with a test).

- [ ] **Step 1: Local run on a throwaway copy of the local database** (as in the content languages plans: copy `thecms` to `thecms_shoptest`, run the worktree backend on port 3100 with `MONGODB_URI` pointing at it, Azurite running).

1. Startup log shows the backend running; the "Product" model exists (`GET /content-types`, `system: 'product'`); the private container `downloads` exists in Azurite and has no public access.
2. `PUT /commerce/settings` with CZK (default) and EUR and Standard 21 %.
3. `POST /commerce/products` "Bike T-shirt" PHYSICAL; `PUT .../:id` with a Size option S/M and `active: true`; `PUT .../:id/variants` with prices CZK and EUR for S, CZK only for M, tracked stock 3 and 0.
4. Publish the product entry (`PUT /entries/:entryId/publish`).
5. Create a site key on the copy and read `GET /public/shop/products`, `?currency=EUR`, `?language=cs` (after adding `cs` and translating the entry), `GET /public/shop/products/:entryId`.
6. A DIGITAL product: upload a small `.gpx`, confirm the blob is in `downloads` and that its URL without a SAS returns 403/404.
7. Try deleting `cs` while a product entry exists only in `cs`: `409`.
8. Delete both products; entries and variants gone.

- [ ] **Step 2: Record and commit**

Append "E-shop catalogue Plan 1 verification" to `TEST_RESULTS.md`, drop the throwaway database and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record e-shop catalogue Plan 1 verification"
```

---

## Self-Review Notes

- **Spec coverage:** 4.1 settings → Task 1; 4.2 and 4.3 products and variants → Tasks 1 and 3; 4.4 Product model and guards → Task 2 (plus the language guard, Decision 4); 4.5 for-sale rules → Task 5; 5 admin → Plan 2 (the backend list fields in Task 3 feed it); 6.1 to 6.3 public API → Task 5; 6.4 webhooks → Task 6; 7 errors → Tasks 1 to 5; 8 backend testing → every task, Cosmos sort test → Task 5, browser check → Task 7 and Plan 2.
- **Type consistency:** `SettingsService.get/replace/assertReady`, `ProductType`, `ProductOption`, `DigitalFile`, `IVariant`, `ensureProductModel`, `productContentTypeId`, `PRODUCT_CORE_FIELDS`, `ProductsService.create/list/get/update/remove`, `VariantsService.replaceAll`, `uploadDigitalFile`, `deleteDigitalFile`, `resolveCurrency`, `listShopProducts`, `getShopProduct` are used with the same names in every task.
