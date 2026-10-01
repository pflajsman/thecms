jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./order-emails', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

import { useTestDb } from '../../test/db';
import { VariantModel } from '../../models/variant.model';
import { seedShop, placeTestOrder } from './test-shop';
import { VariantsService } from './variants.service';

useTestDb();

it('keeps stock taken by orders when the admin saves the quantity it loaded earlier', async () => {
  const shop = await seedShop();
  const loaded = await VariantModel.find({ productId: shop.teeProduct }).sort({ createdAt: 1 }).lean();
  const rows = loaded.map((v) => ({
    id: String(v._id),
    sku: v.sku,
    optionValues: v.optionValues,
    prices: { CZK: 52000 },
    weightGrams: v.weightGrams,
    stock: { tracked: true, quantity: v.stock.quantity, baseQuantity: v.stock.quantity },
    active: true,
  }));
  await placeTestOrder(shop); // takes one S while the admin form is open
  rows[1].stock.quantity = 10; // the admin adds 7 to M
  await VariantsService.replaceAll(String(shop.teeProduct), rows as never);
  expect((await VariantModel.findById(shop.teeS).lean())?.stock.quantity).toBe(2);
  expect((await VariantModel.findById(shop.teeM).lean())?.stock.quantity).toBe(10);
});

it('saves a digital variant sent without a stock field', async () => {
  const shop = await seedShop();
  const guide = await VariantModel.findById(shop.guide).lean();
  const row = { id: String(guide!._id), sku: 'GUIDE', optionValues: {}, prices: { CZK: 31900 }, active: true };
  await VariantsService.replaceAll(String(shop.guideProduct), [row] as never);
  expect((await VariantModel.findById(shop.guide).lean())?.prices).toEqual({ CZK: 31900 });
});
