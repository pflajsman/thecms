jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./order-emails', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

import { useTestDb } from '../../test/db';
import { OrderModel } from '../../models/order.model';
import { VariantModel } from '../../models/variant.model';
import { seedShop, type Shop } from './test-shop';
import { placeOrder } from './orders.service';
import type { OrderInput } from './checkout.schema';

useTestDb();

let shop: Shop;
beforeEach(async () => {
  shop = await seedShop();
});

const address = { name: 'Jana Nováková', street: 'Hlavní 1', city: 'Praha', postalCode: '11000', country: 'CZ' };
function input(email = 'jana@example.test'): OrderInput {
  return {
    currency: 'CZK',
    items: [{ variantId: shop.teeS, quantity: 1 }],
    country: 'CZ',
    shippingMethodId: shop.courier,
    paymentMethod: 'BANK_TRANSFER',
    customer: { email, name: 'Jana' },
    billingAddress: address,
    shippingAddress: address,
    acceptTerms: true,
    expectedTotal: 49000 + 12900,
  } as OrderInput;
}
const siteA = '64b000000000000000000001';
const siteB = '64b000000000000000000002';

it('scopes Idempotency-Key per site: the same key from two sites makes two orders', async () => {
  const a = await placeOrder(input(), { idempotencyKey: 'checkout-1', siteId: siteA, skipHooks: true });
  const b = await placeOrder(input('petr@example.test'), { idempotencyKey: 'checkout-1', siteId: siteB, skipHooks: true });
  expect(b.replay).toBe(false);
  expect(b.order.number).not.toBe(a.order.number);
  expect(await OrderModel.countDocuments()).toBe(2);
});

it('refuses a reused key with a different order instead of returning the other order', async () => {
  await placeOrder(input(), { idempotencyKey: 'k-1', siteId: siteA, skipHooks: true });
  await expect(placeOrder(input('petr@example.test'), { idempotencyKey: 'k-1', siteId: siteA, skipHooks: true })).rejects.toMatchObject({
    statusCode: 422,
    details: { reason: 'IDEMPOTENCY_KEY_REUSED' },
  });
});

it('returns the in-flight order instead of out of stock when a same-key retry arrives mid-placement', async () => {
  await VariantModel.updateOne({ _id: shop.teeS }, { $set: { 'stock.quantity': 1 } });
  const first = await placeOrder(input(), { idempotencyKey: 'k-2', siteId: siteA, skipHooks: true });
  // The retry's first lookup ran before the first request saved its order.
  const spy = jest.spyOn(OrderModel, 'findOne').mockReturnValueOnce({ exec: () => Promise.resolve(null), then: (r: (v: null) => unknown) => Promise.resolve(null).then(r) } as never);
  const retry = await placeOrder(input(), { idempotencyKey: 'k-2', siteId: siteA, skipHooks: true });
  spy.mockRestore();
  expect(retry).toMatchObject({ replay: true, order: { number: first.order.number } });
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(0);
});
