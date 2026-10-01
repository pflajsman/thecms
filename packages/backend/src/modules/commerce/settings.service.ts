import { ShopSettingsModel, type IShopSettings } from '../../models/shop-settings.model';
import { ProductModel } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import { AppError } from '../../middleware/error.middleware';
import type { SettingsInput } from './commerce.schema';

export class SettingsService {
  static async get(): Promise<IShopSettings> {
    return (await ShopSettingsModel.findOne()) ?? new ShopSettingsModel({ currencies: [], vatRates: [] });
  }

  static async assertReady(): Promise<IShopSettings> {
    const s = await SettingsService.get();
    if (s.currencies.length === 0 || s.vatRates.length === 0) throw new AppError('Add a currency and a VAT rate first', 409);
    return s;
  }

  static async replace(input: SettingsInput): Promise<IShopSettings> {
    const current = await SettingsService.get();
    for (const c of current.currencies) {
      const next = input.currencies.find((n) => n.code === c.code);
      if (next && next.decimals === c.decimals) continue;
      if (await VariantModel.exists({ [`prices.${c.code}`]: { $exists: true } })) {
        // Prices are stored in minor units, so changing decimals would change every price.
        throw new AppError(
          next
            ? `Currency ${c.code} has prices; its decimals cannot change`
            : `Currency ${c.code} has prices; remove them from the variants first`,
          409
        );
      }
    }
    for (const r of current.vatRates) {
      if (input.vatRates.some((n) => n.id === r.id)) continue;
      if (await ProductModel.exists({ vatRateId: r.id })) throw new AppError(`VAT rate ${r.name} is used by products`, 409);
    }
    // Without currencies there is no default; Mongoose drops undefined from $set, so unset it explicitly.
    const cleared = (['shopEmail', 'termsUrl'] as const).filter((k) => input[k] === null);
    const set = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== null));
    const unset = Object.fromEntries(cleared.map((k) => [k, '']));
    const update = input.currencies.length
      ? { $set: set, ...(cleared.length ? { $unset: unset } : {}) }
      : { $set: { currencies: [], vatRates: input.vatRates }, $unset: { defaultCurrency: '', ...unset } };
    return ShopSettingsModel.findOneAndUpdate({}, update, { upsert: true, new: true });
  }
}
