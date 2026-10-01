import mongoose from 'mongoose';
import { ProductModel, type IProduct, type Labels } from '../../models/product.model';
import { VariantModel, type IVariant } from '../../models/variant.model';
import { ContentEntryModel, ContentStatus, type IContentEntry } from '../../models/content-entry.model';
import { AppError } from '../../middleware/error.middleware';
import { SettingsService } from './settings.service';
import { productContentTypeId } from './product-model';

export async function resolveCurrency(requested?: unknown): Promise<string> {
  const settings = await SettingsService.get();
  const codes = settings.currencies.map((c) => c.code);
  if (typeof requested !== 'string' || requested.trim() === '') return settings.defaultCurrency ?? codes[0] ?? '';
  const code = requested.trim().toUpperCase();
  if (!codes.includes(code)) throw new AppError(`Unknown currency '${code}'. Use one of: ${codes.join(', ')}`, 400);
  return code;
}

const label = (labels: Labels | undefined, language: string, defaultLanguage: string) =>
  labels?.[language] ?? labels?.[defaultLanguage] ?? Object.values(labels ?? {})[0] ?? '';

/** Published version per item: the requested language, else the default language. */
async function contentFor(itemIds: mongoose.Types.ObjectId[], language: string, defaultLanguage: string) {
  const versions = await ContentEntryModel.find({ itemId: { $in: itemIds }, status: ContentStatus.PUBLISHED, language: { $in: [language, defaultLanguage] } }).exec();
  const byItem = new Map<string, IContentEntry>();
  for (const v of versions) {
    const key = String(v.itemId);
    const current = byItem.get(key);
    if (!current || (current.language !== language && v.language === language)) byItem.set(key, v);
  }
  return byItem;
}

function toPublic(product: IProduct, variants: IVariant[], entry: IContentEntry, currency: string, vatRate: number, language: string, defaultLanguage: string) {
  const sellable = variants.filter((v) => v.active && typeof v.prices?.[currency] === 'number');
  const prices = sellable.map((v) => v.prices[currency]);
  return {
    id: String(product._id),
    type: product.type,
    itemId: String(product.itemId),
    currency,
    content: { ...entry.toJSON(), language: entry.language, fallback: entry.language !== language },
    options: product.options.map((o) => ({
      key: o.key,
      label: label(o.labels, language, defaultLanguage),
      values: o.values.map((v) => ({ key: v.key, label: label(v.labels, language, defaultLanguage) })),
    })),
    variants: sellable.map((v) => ({
      id: String(v._id),
      sku: v.sku,
      optionValues: v.optionValues,
      price: v.prices[currency],
      vatRate,
      available: !v.stock?.tracked || v.stock.quantity > 0,
      availableQuantity: v.stock?.tracked ? v.stock.quantity : null,
    })),
    priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  };
}

export type PublicProduct = ReturnType<typeof toPublic>;

export interface ShopListOptions {
  currency: string;
  language: string;
  defaultLanguage: string;
  page: number;
  limit: number;
  ids?: string[];
}

async function vatRates(): Promise<Map<string, number>> {
  return new Map((await SettingsService.get()).vatRates.map((r) => [r.id, r.rate]));
}

/** Product and item ids for `ids`, which may name products, items or entry versions. */
async function resolveIds(ids: string[]): Promise<{ productIds: mongoose.Types.ObjectId[]; itemIds: mongoose.Types.ObjectId[] }> {
  const objectIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  const viaVersions = await ContentEntryModel.distinct('itemId', { _id: { $in: objectIds } });
  return { productIds: objectIds, itemIds: [...objectIds, ...viaVersions] };
}

function mapPage(
  products: IProduct[],
  variants: IVariant[],
  content: Map<string, IContentEntry>,
  rates: Map<string, number>,
  opts: { currency: string; language: string; defaultLanguage: string }
): PublicProduct[] {
  return products.flatMap((p) => {
    const entry = content.get(String(p.itemId));
    if (!entry) return [];
    const own = variants.filter((v) => String(v.productId) === String(p._id));
    const item = toPublic(p, own, entry, opts.currency, rates.get(p.vatRateId) ?? 0, opts.language, opts.defaultLanguage);
    return item.variants.length ? [item] : [];
  });
}

export async function listShopProducts(opts: ShopListOptions) {
  const { currency, language, defaultLanguage, page, limit, ids } = opts;
  const contentTypeId = await productContentTypeId();
  const [published, priced] = await Promise.all([
    // Only items with content in the requested or the default language can be shown, so only they count.
    ContentEntryModel.distinct('itemId', { contentTypeId, status: ContentStatus.PUBLISHED, language: { $in: [language, defaultLanguage] } }),
    VariantModel.distinct('productId', { active: true, [`prices.${currency}`]: { $exists: true } }),
  ]);
  const filter: Record<string, unknown> = { active: true, _id: { $in: priced }, itemId: { $in: published } };
  if (ids && ids.length) {
    const { productIds, itemIds } = await resolveIds(ids);
    filter.$or = [{ _id: { $in: productIds } }, { itemId: { $in: itemIds } }];
  }
  const [products, total] = await Promise.all([
    ProductModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
    ProductModel.countDocuments(filter),
  ]);
  const [variants, content, rates] = await Promise.all([
    VariantModel.find({ productId: { $in: products.map((p) => p._id) } }).sort({ createdAt: 1 }).exec(),
    contentFor(products.map((p) => p.itemId), language, defaultLanguage),
    vatRates(),
  ]);
  return {
    products: mapPage(products, variants, content, rates, { currency, language, defaultLanguage }),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getShopProduct(id: string, currency: string, language: string, defaultLanguage: string): Promise<PublicProduct | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const { productIds, itemIds } = await resolveIds([id]);
  const product = await ProductModel.findOne({ active: true, $or: [{ _id: { $in: productIds } }, { itemId: { $in: itemIds } }] }).exec();
  if (!product) return null;
  const [variants, content, rates] = await Promise.all([
    VariantModel.find({ productId: product._id }).sort({ createdAt: 1 }).exec(),
    contentFor([product.itemId], language, defaultLanguage),
    vatRates(),
  ]);
  return mapPage([product], variants, content, rates, { currency, language, defaultLanguage })[0] ?? null;
}
