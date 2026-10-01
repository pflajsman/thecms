jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./order-emails', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../config/storage', () => ({ storageService: { privateFileSasUrl: jest.fn().mockResolvedValue('https://blob.test/sas') } }));
jest.mock('../../middleware/apiKey.middleware', () => ({ apiKeyMiddleware: (_req: unknown, _res: unknown, next: () => void) => next() }));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { DownloadGrantModel } from '../../models/download-grant.model';
import { seedShop, placeTestOrder } from './test-shop';
import { OrderActions } from './order-actions';
import publicRoutes from '../public/public.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/public', publicRoutes);
app.use(errorMiddleware);

it('redirects to a short-lived private link and counts downloads up to the limit', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { digital: true });
  await OrderActions.markPaid(String(order._id));
  const grant = await DownloadGrantModel.findOne({ orderId: order._id }).lean();
  for (let i = 0; i < 5; i++) {
    const res = await request(app).get(`/public/shop/downloads/${grant!.token}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://blob.test/sas');
  }
  expect((await DownloadGrantModel.findById(grant!._id).lean())?.used).toBe(5);
  expect((await request(app).get(`/public/shop/downloads/${grant!.token}`)).status).toBe(410);
});

it('refuses expired and unknown links', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { digital: true });
  await OrderActions.markPaid(String(order._id));
  const grant = await DownloadGrantModel.findOne({ orderId: order._id }).lean();
  await DownloadGrantModel.updateOne({ _id: grant!._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await request(app).get(`/public/shop/downloads/${grant!.token}`)).status).toBe(410);
  expect((await request(app).get('/public/shop/downloads/nope')).status).toBe(404);
});
