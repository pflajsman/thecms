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
