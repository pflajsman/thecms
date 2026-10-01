jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./order-emails', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { seedShop, placeTestOrder } from './test-shop';
import commerceRoutes from './commerce.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/commerce', commerceRoutes);
app.use(errorMiddleware);

it('lists, searches and filters orders, counts those needing action, and runs actions', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  expect((await request(app).get('/commerce/orders').query({ search: 'jana' })).body.data.map((o: { number: string }) => o.number)).toEqual([order.number]);
  expect((await request(app).get('/commerce/orders').query({ search: order.number.slice(0, 6) })).body.pagination.total).toBe(1);
  expect((await request(app).get('/commerce/orders').query({ paymentStatus: 'PAID' })).body.data).toEqual([]);
  expect((await request(app).get('/commerce/orders/needs-action')).body.data).toEqual({ count: 0 });
  const paid = await request(app).post(`/commerce/orders/${order._id}/paid`);
  expect(paid.body.data.paymentStatus).toBe('PAID');
  expect((await request(app).get('/commerce/orders/needs-action')).body.data).toEqual({ count: 1 });
  const shipped = await request(app).post(`/commerce/orders/${order._id}/shipped`).send({ trackingNumber: 'DR1' });
  expect(shipped.body.data).toMatchObject({ status: 'COMPLETED', tracking: { number: 'DR1' } });
  const detail = await request(app).get(`/commerce/orders/${order._id}`);
  expect(detail.body.data.history.map((h: { type: string }) => h.type)).toEqual(expect.arrayContaining(['placed', 'paid', 'shipped']));
  expect((await request(app).put(`/commerce/orders/${order._id}/note`).send({ note: 'Gift wrap' })).body.data.internalNote).toBe('Gift wrap');
  expect((await request(app).post(`/commerce/orders/${order._id}/paid`)).status).toBe(409);
});
