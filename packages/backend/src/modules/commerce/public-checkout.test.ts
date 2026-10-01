jest.mock('../../middleware/apiKey.middleware', () => ({ apiKeyMiddleware: (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { seedShop } from './test-shop';
import publicRoutes from '../public/public.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/public', publicRoutes);
app.use(errorMiddleware);

it('quotes a cart with Czech names, shipping without cash on delivery for a digital line, and totals', async () => {
  const shop = await seedShop();
  const res = await request(app)
    .post('/public/shop/quote')
    .send({ currency: 'CZK', language: 'cs', items: [{ variantId: shop.teeS, quantity: 2 }, { variantId: shop.guide, quantity: 1 }], country: 'CZ', shippingMethodId: shop.courier, paymentMethod: 'BANK_TRANSFER' });
  expect(res.status).toBe(200);
  expect(res.body.data.lines.map((l: { name: string; quantity: number }) => [l.name, l.quantity])).toEqual([['Cyklistické tričko', 2], ['Průvodce Šumavou', 1]]);
  expect(res.body.data.shippingOptions).toEqual([{ id: shop.courier, name: 'Kurýr', price: 12900, paymentMethods: [{ method: 'BANK_TRANSFER', fee: 0 }] }]);
  expect(res.body.data.totals.total).toBe(98000 + 29900 + 12900);
  expect(res.body.data.problems).toEqual([]);
});

it('rejects bad quantities, too many items and malformed ids', async () => {
  const shop = await seedShop();
  const bad = [
    { items: [{ variantId: shop.teeS, quantity: 0 }] },
    { items: [{ variantId: shop.teeS, quantity: 100 }] },
    { items: Array.from({ length: 51 }, () => ({ variantId: shop.teeS, quantity: 1 })) },
    { items: [{ variantId: 'abc', quantity: 1 }] },
  ];
  for (const body of bad) expect((await request(app).post('/public/shop/quote').send(body)).status).toBe(400);
});

it('lists the countries the shop ships to', async () => {
  await seedShop();
  expect((await request(app).get('/public/shop/shipping-countries')).body.data).toEqual(['CZ']);
});
