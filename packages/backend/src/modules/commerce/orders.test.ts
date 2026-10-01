jest.mock('../../middleware/apiKey.middleware', () => ({ apiKeyMiddleware: (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { VariantModel } from '../../models/variant.model';
import { OrderModel } from '../../models/order.model';
import { seedShop, type Shop } from './test-shop';
import { nextOrderNumber, reserveStock } from './orders.service';
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

it('reserveStock gives back what it took when a later line cannot be served', async () => {
  await expect(reserveStock([{ variantId: shop.teeS, quantity: 1 }, { variantId: shop.teeM, quantity: 5 }])).rejects.toMatchObject({ statusCode: 409 })
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(3)
  expect((await VariantModel.findById(shop.teeM).lean())?.stock.quantity).toBe(3)
})
