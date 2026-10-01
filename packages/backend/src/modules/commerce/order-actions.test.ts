jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./order-emails', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

import { useTestDb } from '../../test/db';
import { VariantModel } from '../../models/variant.model';
import { DownloadGrantModel } from '../../models/download-grant.model';
import { WebhookService } from '../../services/webhook.service';
import { notify } from './order-emails';
import { seedShop, placeTestOrder } from './test-shop';
import { OrderActions } from './order-actions';

useTestDb();

it('marks an order paid, issues download grants for digital lines and fires order.paid', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { digital: true });
  const paid = await OrderActions.markPaid(String(order._id), 'admin-1');
  expect(paid.paymentStatus).toBe('PAID');
  expect(paid.history.map((h) => h.type)).toContain('paid');
  expect(await DownloadGrantModel.countDocuments({ orderId: order._id })).toBe(1);
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ number: order.number }), 'paid');
  expect(WebhookService.triggerEvent).toHaveBeenCalledWith('order.paid', expect.objectContaining({ order: expect.objectContaining({ number: order.number }) }));
  await expect(OrderActions.markPaid(String(order._id))).rejects.toMatchObject({ statusCode: 409 });
});

it('completes an order once it is paid and shipped; cash on delivery is paid when shipped', async () => {
  const shop = await seedShop();
  const cod = await placeTestOrder(shop, { payment: 'CASH_ON_DELIVERY' });
  const shipped = await OrderActions.markShipped(String(cod._id), { trackingNumber: 'DR123', trackingUrl: 'https://track.test/DR123' });
  expect(shipped).toMatchObject({ fulfilmentStatus: 'SHIPPED', paymentStatus: 'PAID', status: 'COMPLETED', tracking: { number: 'DR123' } });
});

it('cancels an order, returns stock, and marks a paid one refunded on request', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(2);
  await OrderActions.markPaid(String(order._id));
  const cancelled = await OrderActions.cancel(String(order._id), { refunded: true });
  expect(cancelled).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' });
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(3);
  await expect(OrderActions.markShipped(String(order._id), {})).rejects.toMatchObject({ statusCode: 409 });
  await expect(OrderActions.cancel(String(order._id), {})).rejects.toMatchObject({ statusCode: 409 });
});

it('resending downloads expires the old links and issues new ones', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { digital: true });
  await OrderActions.markPaid(String(order._id));
  const first = await DownloadGrantModel.findOne({ orderId: order._id }).lean();
  await OrderActions.resend(String(order._id), 'downloads');
  const grants = await DownloadGrantModel.find({ orderId: order._id }).lean();
  expect(grants).toHaveLength(2);
  expect(grants.find((g) => g.token === first?.token)?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
});

