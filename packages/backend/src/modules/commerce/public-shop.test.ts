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
