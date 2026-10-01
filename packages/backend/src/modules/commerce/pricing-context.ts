import mongoose from 'mongoose';
import { ProductModel } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import { ShippingMethodModel, ShippingZoneModel } from '../../models/shipping.model';
import { resolveLanguage } from '../public/public-content.service';
import { SettingsService } from './settings.service';
import { contentFor, label, resolveCurrency } from './public-shop.service';
import { priceCart, type CartInput, type PricingContext, type Quote } from './pricing';

/** Everything priceCart needs, loaded from the database for one cart. */
export async function loadPricingContext(input: CartInput): Promise<PricingContext> {
  const { language, defaultLanguage } = await resolveLanguage(input.language);
  const code = await resolveCurrency(input.currency);
  const settings = await SettingsService.get();
  const currency = settings.currencies.find((c) => c.code === code) ?? { code, decimals: 2 };
  const rates = new Map(settings.vatRates.map((r) => [r.id, r.rate]));

  const ids = [...new Set(input.items.map((i) => i.variantId))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const variants = await VariantModel.find({ _id: { $in: ids } }).exec();
  const products = await ProductModel.find({ _id: { $in: variants.map((v) => v.productId) } }).exec();
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const content = await contentFor(products.map((p) => p.itemId), language, defaultLanguage);

  const map: PricingContext['variants'] = new Map();
  for (const v of variants) {
    const product = productById.get(String(v.productId));
    if (!product) continue;
    const entry = content.get(String(product.itemId));
    const optionLabels = product.options.map((o) => {
      const value = o.values.find((x) => x.key === v.optionValues?.[o.key]);
      return { option: label(o.labels, language, defaultLanguage), value: value ? label(value.labels, language, defaultLanguage) : (v.optionValues?.[o.key] ?? '') };
    });
    const price = v.prices?.[code];
    map.set(String(v._id), {
      id: String(v._id),
      productId: String(product._id),
      itemId: String(product.itemId),
      sku: v.sku,
      type: product.type,
      name: (entry?.data?.name as string | undefined) || entry?.title || '',
      optionLabels,
      price: typeof price === 'number' ? price : undefined,
      vatRate: rates.get(product.vatRateId) ?? 0,
      weightGrams: product.type === 'PHYSICAL' ? v.weightGrams ?? 0 : 0,
      tracked: !!v.stock?.tracked,
      quantity: v.stock?.quantity ?? 0,
      // Catalogue spec 4.5, rules 1 to 3; the price (rule 4) is checked by priceCart.
      forSale: product.active && v.active && !!entry,
    });
  }

  const [zones, methods] = await Promise.all([
    ShippingZoneModel.find().sort({ order: 1 }).lean(),
    ShippingMethodModel.find({ active: true }).sort({ order: 1 }).lean(),
  ]);
  return {
    currency,
    language,
    defaultLanguage,
    variants: map,
    zones: zones.map((z) => ({ id: String(z._id), countries: z.countries, rest: z.rest })),
    methods: methods.map((m) => ({
      id: String(m._id),
      name: label(m.labels, language, defaultLanguage),
      paymentMethods: m.paymentMethods,
      codFees: m.codFees ?? {},
      freeOver: m.freeOver ?? {},
      rates: m.rates.map((r) => ({ zoneId: String(r.zoneId), bands: r.bands })),
    })),
  };
}

export async function quote(input: CartInput): Promise<Quote> {
  return priceCart(input, await loadPricingContext(input));
}
