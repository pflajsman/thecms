jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./order-emails', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

import { useTestDb } from '../../test/db';
import { OrderModel } from '../../models/order.model';
import { VariantModel } from '../../models/variant.model';
import { notify } from './order-emails';
import { seedShop, placeTestOrder } from './test-shop';
import { cancelStaleUnpaidOrders } from './unpaid-job';

useTestDb();

it('cancels unpaid bank transfers older than the setting, once, even with two runners', async () => {
  const shop = await seedShop();
  const stale = await placeTestOrder(shop);
  const fresh = await placeTestOrder(shop);
  const cod = await placeTestOrder(shop, { payment: 'CASH_ON_DELIVERY' });
  const old = new Date(Date.now() - 15 * 24 * 3600_000);
  // Mongoose keeps createdAt immutable, so move it on the raw collection.
  await OrderModel.collection.updateMany({ _id: { $in: [stale._id, cod._id] } }, { $set: { createdAt: old } });
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(0);

  const [a, b] = await Promise.all([cancelStaleUnpaidOrders(), cancelStaleUnpaidOrders()]);
  expect(a + b).toBe(1);
  expect((await OrderModel.findById(stale._id).lean())?.status).toBe('CANCELLED');
  expect((await OrderModel.findById(fresh._id).lean())?.status).toBe('PLACED');
  expect((await OrderModel.findById(cod._id).lean())?.status).toBe('PLACED');
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(1);
  expect(jest.mocked(notify).mock.calls.filter((c) => c[1] === 'cancelled')).toHaveLength(1);
});

it('leaves a shipped but unpaid bank transfer alone', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  await OrderModel.collection.updateOne(
    { _id: order._id },
    { $set: { fulfilmentStatus: 'SHIPPED', createdAt: new Date(Date.now() - 15 * 24 * 3600_000) } }
  );
  expect(await cancelStaleUnpaidOrders()).toBe(0);
  expect((await OrderModel.findById(order._id).lean())?.status).toBe('PLACED');
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(2);
});
