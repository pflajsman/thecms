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

it('adding the first option keeps the existing variant as the first combination', async () => {
  await ready();
  const created = (await request(app).post('/commerce/products').send({ name: 'Tee', type: 'PHYSICAL' })).body.data;
  const base = created.variants[0];
  await request(app).put(`/commerce/products/${created.product.id}/variants`).send({
    variants: [{ ...base, prices: { CZK: 49000 }, stock: { tracked: true, quantity: 7 } }],
  });
  const res = await request(app).put(`/commerce/products/${created.product.id}`).send({ options: sizes });
  const kept = res.body.data.variants.find((v: { id: string }) => v.id === base.id);
  expect(kept).toMatchObject({ sku: base.sku, optionValues: { size: 's' }, prices: { CZK: 49000 }, stock: { quantity: 7 } });
  expect(res.body.data.removedVariantIds).toEqual([]);
  expect(res.body.data.variants).toHaveLength(2);
});
