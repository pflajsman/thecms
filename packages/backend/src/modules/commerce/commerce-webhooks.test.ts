jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import { useTestDb } from '../../test/db';
import { WebhookService } from '../../services/webhook.service';
import { LanguageModel } from '../../models/language.model';
import { SettingsService } from './settings.service';
import { ProductsService } from './products.service';
import { VariantsService } from './variants.service';

useTestDb();

beforeEach(async () => {
  await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
  await SettingsService.replace({ currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }] });
});

it('sends product.updated, stock.changed only when a quantity changes, and product.deleted', async () => {
  const p = await ProductsService.create({ name: 'Tee', type: 'PHYSICAL' as never });
  const triggered = jest.mocked(WebhookService.triggerEvent);
  triggered.mockClear();

  await ProductsService.update(p.product.id, { active: true });
  expect(triggered).toHaveBeenCalledWith('product.updated', expect.objectContaining({ product: expect.objectContaining({ id: p.product.id, active: true }) }));

  triggered.mockClear();
  const row = { ...p.variants[0], stock: { tracked: true, quantity: 5 } };
  await VariantsService.replaceAll(p.product.id, [row]);
  expect(triggered).toHaveBeenCalledWith('stock.changed', expect.objectContaining({ variantIds: [p.variants[0].id] }));

  triggered.mockClear();
  await VariantsService.replaceAll(p.product.id, [{ ...row, prices: { CZK: 100 } }]);
  expect(triggered.mock.calls.map((c) => c[0])).toEqual(['product.updated']);

  triggered.mockClear();
  await ProductsService.remove(p.product.id);
  expect(triggered).toHaveBeenCalledWith('product.deleted', expect.objectContaining({ product: expect.objectContaining({ id: p.product.id }) }));
});
