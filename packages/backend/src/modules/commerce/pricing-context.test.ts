jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));

import { useTestDb } from '../../test/db';
import { LanguageModel } from '../../models/language.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { ProductModel } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { SettingsService } from './settings.service';
import { ProductsService } from './products.service';
import { ShippingService } from './shipping.service';
import { loadPricingContext, quote } from './pricing-context';

useTestDb();

async function seed() {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  await SettingsService.replace({
    currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
    defaultCurrency: 'CZK',
    vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }],
  });
  const tee = await ProductsService.create({ name: 'Bike T-shirt', type: 'PHYSICAL' });
  await ProductsService.update(tee.product.id, {
    active: true,
    options: [{ key: 'size', labels: { en: 'Size', cs: 'Velikost' }, values: [{ key: 's', labels: { en: 'S' } }] }],
  });
  const variant = await VariantModel.findOne({ productId: tee.product.id });
  await VariantModel.updateOne({ _id: variant!._id }, { $set: { prices: { CZK: 49000 }, weightGrams: 500, stock: { tracked: true, quantity: 3 } } });
  await ContentEntryModel.updateMany({ itemId: tee.entry.itemId }, { $set: { status: ContentStatus.PUBLISHED, publishedAt: new Date() } });
  const typeId = String((await ContentEntryModel.findOne({ itemId: tee.entry.itemId }))!.contentTypeId);
  await ContentEntriesService.createEntry({ contentTypeId: typeId, data: { name: 'Cyklistické tričko' }, language: 'cs', itemId: tee.entry.itemId, status: ContentStatus.PUBLISHED });
  const zone = await ShippingService.createZone({ name: 'Czechia', countries: ['CZ'], rest: false });
  await ShippingService.createMethod({ labels: { en: 'Courier', cs: 'Kurýr' }, active: true, paymentMethods: ['BANK_TRANSFER'], codFees: {}, freeOver: {}, rates: [{ zoneId: String(zone._id), bands: [{ upToGrams: null, prices: { CZK: 12900 } }] }] });
  return { tee, variantId: String(variant!._id) };
}

it('loads names and labels in the requested language, prices, VAT and shipping', async () => {
  const { variantId } = await seed();
  const ctx = await loadPricingContext({ currency: 'CZK', language: 'cs', items: [{ variantId, quantity: 1 }] });
  expect(ctx.variants.get(variantId)).toMatchObject({
    name: 'Cyklistické tričko',
    optionLabels: [{ option: 'Velikost', value: 'S' }],
    price: 49000,
    vatRate: 2100,
    weightGrams: 500,
    tracked: true,
    quantity: 3,
    forSale: true,
    type: 'PHYSICAL',
  });
  expect(ctx.methods.map((m) => m.name)).toEqual(['Kurýr']);
  const q = await quote({ currency: 'CZK', language: 'cs', items: [{ variantId, quantity: 1 }], country: 'CZ' });
  expect(q.shippingOptions.map((o) => [o.name, o.price])).toEqual([['Kurýr', 12900]]);
});

it('marks variants not for sale and leaves the price out in another currency', async () => {
  const { tee, variantId } = await seed();
  expect((await loadPricingContext({ currency: 'EUR', language: 'en', items: [{ variantId, quantity: 1 }] })).variants.get(variantId)?.price).toBeUndefined();
  await ProductModel.updateOne({ _id: tee.product.id }, { $set: { active: false } });
  expect((await loadPricingContext({ currency: 'CZK', language: 'en', items: [{ variantId, quantity: 1 }] })).variants.get(variantId)?.forSale).toBe(false);
  await ProductModel.updateOne({ _id: tee.product.id }, { $set: { active: true } });
  await ContentEntryModel.updateMany({ itemId: tee.entry.itemId }, { $set: { status: ContentStatus.DRAFT } });
  expect((await loadPricingContext({ currency: 'CZK', language: 'en', items: [{ variantId, quantity: 1 }] })).variants.get(variantId)?.forSale).toBe(false);
});

it('rejects an unknown currency or language', async () => {
  const { variantId } = await seed();
  await expect(loadPricingContext({ currency: 'USD', language: 'en', items: [{ variantId, quantity: 1 }] })).rejects.toMatchObject({ statusCode: 400 });
  await expect(loadPricingContext({ currency: 'CZK', language: 'xx', items: [{ variantId, quantity: 1 }] })).rejects.toMatchObject({ statusCode: 400 });
});
