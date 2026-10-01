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
      if (input.currencies.some((n) => n.code === c.code)) continue;
      if (await VariantModel.exists({ [`prices.${c.code}`]: { $exists: true } })) {
        throw new AppError(`Currency ${c.code} has prices; remove them from the variants first`, 409);
      }
    }
    for (const r of current.vatRates) {
      if (input.vatRates.some((n) => n.id === r.id)) continue;
      if (await ProductModel.exists({ vatRateId: r.id })) throw new AppError(`VAT rate ${r.name} is used by products`, 409);
    }
    return ShopSettingsModel.findOneAndUpdate({}, { $set: input }, { upsert: true, new: true });
  }
}
