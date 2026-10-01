/* Test helper: a small shop with a sized T-shirt, a digital guide, a CZ zone and a courier. */
import { LanguageModel } from '../../models/language.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { ProductModel } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { SettingsService } from './settings.service';
import { ProductsService } from './products.service';
import { ShippingService } from './shipping.service';

export interface Shop {
  teeS: string
  teeM: string
  guide: string
  courier: string
  zoneCz: string
  teeProduct: string
  guideProduct: string
}

async function publishWithCzech(itemId: string, czechName: string) {
  await ContentEntryModel.updateMany({ itemId }, { $set: { status: ContentStatus.PUBLISHED, publishedAt: new Date() } });
  const typeId = String((await ContentEntryModel.findOne({ itemId }))!.contentTypeId);
  await ContentEntriesService.createEntry({ contentTypeId: typeId, data: { name: czechName }, language: 'cs', itemId, status: ContentStatus.PUBLISHED });
}

export async function seedShop(): Promise<Shop> {
  await LanguageModel.create([{ code: 'en', name: 'English', isDefault: true, order: 0 }, { code: 'cs', name: 'Čeština', order: 1 }]);
  await SettingsService.replace({
    currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
    defaultCurrency: 'CZK',
    vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }, { id: 'reduced', name: 'Reduced', rate: 1200 }],
    bankAccounts: [{ currency: 'CZK', accountNumber: '19-2000145399/0800', iban: 'CZ6508000000192000145399', holder: 'Test Shop' }],
    termsUrl: 'https://shop.test/terms',
    shopEmail: 'shop@example.test',
  });

  const tee = await ProductsService.create({ name: 'Bike T-shirt', type: 'PHYSICAL' });
  await ProductsService.update(tee.product.id, {
    active: true,
    options: [{ key: 'size', labels: { en: 'Size', cs: 'Velikost' }, values: [{ key: 's', labels: { en: 'S' } }, { key: 'm', labels: { en: 'M' } }] }],
  });
  const sizes = await VariantModel.find({ productId: tee.product.id }).sort({ createdAt: 1 });
  for (const v of sizes) {
    v.sku = v.optionValues.size === 's' ? 'TEE-S' : 'TEE-M';
    v.prices = { CZK: 49000 };
    v.weightGrams = 500;
    v.stock = { tracked: true, quantity: 3 };
    v.markModified('prices');
    await v.save();
  }
  await publishWithCzech(tee.entry.itemId, 'Cyklistické tričko');

  const guide = await ProductsService.create({ name: 'Sumava guide', type: 'DIGITAL' });
  await ProductModel.updateOne(
    { _id: guide.product.id },
    { $set: { active: true, vatRateId: 'reduced', digitalFile: { blobName: 'products/x/guide', originalName: 'guide.pdf', mimeType: 'application/pdf', size: 1000 } } }
  );
  await VariantModel.updateOne({ productId: guide.product.id }, { $set: { sku: 'GUIDE', prices: { CZK: 29900 } } });
  await publishWithCzech(guide.entry.itemId, 'Průvodce Šumavou');

  const zone = await ShippingService.createZone({ name: 'Czechia', countries: ['CZ'], rest: false });
  const courier = await ShippingService.createMethod({
    labels: { en: 'Courier', cs: 'Kurýr' },
    active: true,
    paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'],
    codFees: { CZK: 3900 },
    freeOver: {},
    rates: [{ zoneId: String(zone._id), bands: [{ upToGrams: 2000, prices: { CZK: 12900 } }, { upToGrams: null, prices: { CZK: 19900 } }] }],
  });

  const s = sizes.find((v) => v.optionValues.size === 's')!;
  const m = sizes.find((v) => v.optionValues.size === 'm')!;
  const guideVariant = await VariantModel.findOne({ productId: guide.product.id });
  return {
    teeS: String(s._id),
    teeM: String(m._id),
    guide: String(guideVariant!._id),
    courier: String(courier._id),
    zoneCz: String(zone._id),
    teeProduct: tee.product.id,
    guideProduct: guide.product.id,
  };
}

/** Place an order for one tee (S), plus the guide when digital; returns the saved order. */
export async function placeTestOrder(
  shop: Shop,
  opts: { digital?: boolean; payment?: 'BANK_TRANSFER' | 'CASH_ON_DELIVERY'; language?: string } = {}
) {
  const { placeOrder } = await import('./orders.service');
  const { quote } = await import('./pricing-context');
  const items = [{ variantId: shop.teeS, quantity: 1 }, ...(opts.digital ? [{ variantId: shop.guide, quantity: 1 }] : [])];
  const cart = { currency: 'CZK', language: opts.language ?? 'en', items, country: 'CZ', shippingMethodId: shop.courier, paymentMethod: opts.payment ?? 'BANK_TRANSFER' } as const;
  const q = await quote({ ...cart, items: [...cart.items] });
  const address = { name: 'Jana Nováková', street: 'Hlavní 1', city: 'Praha', postalCode: '11000', country: 'CZ' };
  const { order } = await placeOrder(
    { ...cart, items: [...cart.items], customer: { email: 'jana@example.test', name: 'Jana Nováková' }, billingAddress: address, shippingAddress: address, acceptTerms: true, expectedTotal: q.totals.total },
    { skipHooks: true }
  );
  return order;
}
