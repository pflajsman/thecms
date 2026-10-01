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
