import mongoose from 'mongoose';
import { ProductModel, ProductType } from '../../models/product.model';
import { VariantModel, type IVariant } from '../../models/variant.model';
import { AppError } from '../../middleware/error.middleware';
import { SettingsService } from './settings.service';
import { sameCombo } from './product-rules';
import type { VariantInput } from './commerce.schema';
import { emitProductEvent } from './commerce-events';
import { WebhookEvent } from '../../models/webhook.model';

export class VariantsService {
  /** Save the whole variants table of a product: update rows with an id, add the others, delete the rest. */
  static async replaceAll(productId: string, rows: VariantInput[]): Promise<IVariant[]> {
    if (!mongoose.Types.ObjectId.isValid(productId)) throw new AppError('Invalid product ID', 400);
    const product = await ProductModel.findById(productId);
    if (!product) throw new AppError('Product not found', 404);
    const settings = await SettingsService.get();
    const currencies = settings.currencies.map((c) => c.code);
    const optionKeys = product.options.map((o) => o.key);

    const skus = rows.map((r) => r.sku.trim());
    const repeated = skus.find((sku, i) => skus.indexOf(sku) !== i);
    if (repeated) throw new AppError(`SKU ${repeated} is already used`, 409);
    for (const [i, row] of rows.entries()) {
      const unknown = Object.keys(row.prices).filter((c) => !currencies.includes(c));
      if (unknown.length) throw new AppError(`Unknown currency ${unknown.join(', ')}`, 400);
      const keys = Object.keys(row.optionValues);
      if (keys.length !== optionKeys.length || !optionKeys.every((k) => keys.includes(k)))
        throw new AppError(`Variant ${row.sku} must have a value for every option`, 400);
      for (const o of product.options) {
        if (!o.values.some((v) => v.key === row.optionValues[o.key])) throw new AppError(`Variant ${row.sku} has an unknown ${o.key} value`, 400);
      }
      if (rows.some((other, j) => j !== i && sameCombo(other.optionValues, row.optionValues)))
        throw new AppError('Each combination of options can have only one variant', 400);
    }
    const taken = await VariantModel.findOne({ sku: { $in: skus }, productId: { $ne: product._id } }).select('sku').lean();
    if (taken) throw new AppError(`SKU ${taken.sku} is already used`, 409);

    const existing = await VariantModel.find({ productId: product._id }).exec();
    const stockOf = (v: Pick<IVariant, 'stock'>) => `${v.stock?.tracked}:${v.stock?.quantity}`;
    // Snapshot before the rows are updated in place below.
    const stockBefore = new Map(existing.map((v) => [String(v._id), stockOf(v)]));
    const keepIds = rows.map((r) => r.id).filter((id): id is string => !!id);
    const digital = product.type === ProductType.DIGITAL;
    try {
      // Delete first, then park changed SKUs on temporary values, so SKUs can move or swap between rows.
      await VariantModel.deleteMany({ productId: product._id, _id: { $nin: keepIds } });
      for (const row of rows) {
        const current = row.id ? existing.find((v) => String(v._id) === row.id) : undefined;
        if (current && current.sku !== row.sku.trim()) await VariantModel.updateOne({ _id: current._id }, { $set: { sku: `~tmp-${current._id}` } });
      }
      for (const row of rows) {
        const values = {
          sku: row.sku.trim(),
          optionValues: row.optionValues,
          prices: row.prices,
          weightGrams: digital ? 0 : row.weightGrams,
          stock: digital ? { tracked: false, quantity: 0 } : row.stock,
          active: row.active,
        };
        const current = row.id ? existing.find((v) => String(v._id) === row.id) : undefined;
        if (current) {
          current.set(values);
          current.markModified('prices');
          current.markModified('optionValues');
          await current.save();
        } else {
          await VariantModel.create({ productId: product._id, ...values });
        }
      }
    } catch (error) {
      const duplicate = error as { code?: number; keyValue?: { sku?: string } };
      if (duplicate.code === 11000) throw new AppError(`SKU ${duplicate.keyValue?.sku ?? ''} is already used`.replace('  ', ' '), 409);
      throw error;
    }
    const saved = await VariantModel.find({ productId: product._id }).sort({ createdAt: 1 }).exec();
    const stockChanged = saved
      .filter((v) => {
        const old = stockBefore.get(String(v._id));
        return old !== undefined ? old !== stockOf(v) : v.stock?.tracked;
      })
      .map((v) => String(v._id));
    emitProductEvent(WebhookEvent.PRODUCT_UPDATED, product, saved.map((v) => String(v._id)));
    if (stockChanged.length) emitProductEvent(WebhookEvent.STOCK_CHANGED, product, stockChanged);
    return saved;
  }
}
