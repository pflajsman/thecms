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

