import mongoose from 'mongoose';
import { ProductModel, ProductType, type DigitalFile, type IProduct, type ProductOption } from '../../models/product.model';
import { VariantModel } from '../../models/variant.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { AppError } from '../../middleware/error.middleware';
import { escapeRegex } from '../../utils/regex';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { LanguagesService } from '../languages/languages.service';
import { SettingsService } from './settings.service';
import { productContentTypeId } from './product-model';
import { deleteDigitalFile } from './digital-files';
import { assertOptions, combinations, sameCombo, skuFromName } from './product-rules';
import { emitProductEvent } from './commerce-events';
import { WebhookEvent } from '../../models/webhook.model';

export interface ProductJSON {
  id: string;
  itemId: string;
  type: ProductType;
  vatRateId: string;
  active: boolean;
  options: ProductOption[];
  digitalFile?: DigitalFile;
  createdAt: string;
  updatedAt: string;
}

export interface VariantJSON {
  id: string;
  productId: string;
  sku: string;
  optionValues: Record<string, string>;
  prices: Record<string, number>;
  weightGrams: number;
  stock: { tracked: boolean; quantity: number };
  active: boolean;
}

export interface ProductDetail {
  product: ProductJSON;
  variants: VariantJSON[];
  entry: { itemId: string; defaultVersionId: string | null; name: string };
  removedVariantIds?: string[];
}

export interface ProductListItem {
  id: string;
  itemId: string;
  type: ProductType;
  active: boolean;
  name: string;
  published: boolean;
  variantsCount: number;
  priceRange: { min: number; max: number } | null;
  stock: 'out' | 'low' | null;
}

export interface ListProductsOptions {
  page?: number;
  limit?: number;
  search?: string;
  type?: ProductType | 'PHYSICAL' | 'DIGITAL';
  status?: 'active' | 'inactive' | 'unpublished';
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

const LOW_STOCK = 5;

export async function uniqueSku(base: string, taken: string[] = []): Promise<string> {
  let sku = base;
  for (let n = 2; taken.includes(sku) || (await VariantModel.exists({ sku })); n++) sku = `${base}-${n}`;
  return sku;
}

async function load(id: string): Promise<IProduct> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid product ID', 400);
  const product = await ProductModel.findById(id);
  if (!product) throw new AppError('Product not found', 404);
  return product;
}

/** The entry version that names an item: the default language, else the oldest. */
async function names(itemIds: mongoose.Types.ObjectId[]): Promise<Map<string, { id: string; name: string }>> {
  const defaultCode = await LanguagesService.defaultCode();
  const versions = await ContentEntryModel.find({ itemId: { $in: itemIds } }).select('_id itemId language title createdAt').lean();
  const byItem = new Map<string, { id: string; name: string; isDefault: boolean; createdAt: number }>();
  for (const v of versions) {
    const key = String(v.itemId);
    const candidate = { id: String(v._id), name: v.title, isDefault: v.language === defaultCode, createdAt: new Date(v.createdAt).getTime() };
    const current = byItem.get(key);
    if (!current || (!current.isDefault && (candidate.isDefault || candidate.createdAt < current.createdAt))) byItem.set(key, candidate);
  }
  return new Map([...byItem].map(([k, v]) => [k, { id: v.id, name: v.name }]));
}

export class ProductsService {
  static async create(input: { name: string; type: ProductType | 'PHYSICAL' | 'DIGITAL'; userId?: string }): Promise<ProductDetail> {
    const settings = await SettingsService.assertReady();
    const entry = await ContentEntriesService.createEntry({
      contentTypeId: String(await productContentTypeId()),
      data: { name: input.name },
      createdBy: input.userId,
    });
    let product: IProduct | undefined;
    try {
      product = await ProductModel.create({
        itemId: entry.itemId,
        type: input.type,
        vatRateId: settings.vatRates[0].id,
        active: false,
        createdBy: input.userId,
        updatedBy: input.userId,
      });
      await VariantModel.create({
        productId: product._id,
        sku: await uniqueSku(skuFromName(input.name)),
        stock: { tracked: input.type === ProductType.PHYSICAL, quantity: 0 },
      });
    } catch (error) {
      if (product) await ProductModel.deleteOne({ _id: product._id });
      await ContentEntryModel.deleteMany({ itemId: entry.itemId });
      throw error;
    }
    emitProductEvent(WebhookEvent.PRODUCT_UPDATED, product);
    return ProductsService.get(String(product._id));
  }

  static async get(id: string): Promise<ProductDetail> {
    const product = await load(id);
    const variants = await VariantModel.find({ productId: product._id }).sort({ createdAt: 1 }).exec();
    const named = (await names([product.itemId])).get(String(product.itemId));
    return {
      product: product.toJSON() as unknown as ProductJSON,
      variants: variants.map((v) => v.toJSON() as unknown as VariantJSON),
      entry: { itemId: String(product.itemId), defaultVersionId: named?.id ?? null, name: named?.name ?? '' },
    };
  }

  static async update(
    id: string,
    input: { vatRateId?: string; active?: boolean; options?: ProductOption[] },
    userId?: string
  ): Promise<ProductDetail> {
    const product = await load(id);
    if (input.vatRateId !== undefined) {
      const settings = await SettingsService.get();
      if (!settings.vatRates.some((r) => r.id === input.vatRateId)) throw new AppError(`Unknown VAT rate ${input.vatRateId}`, 400);
      product.vatRateId = input.vatRateId;
    }
    if (input.active !== undefined) product.active = input.active;
    let removedVariantIds: string[] | undefined;
    let rewrittenVariantIds: string[] = [];
    const before = new Set((await VariantModel.find({ productId: product._id }).select('_id').lean()).map((v) => String(v._id)));
    if (input.options !== undefined) {
      const codes = (await LanguagesService.codes()).length ? await LanguagesService.codes() : ['en'];
      assertOptions(input.options, codes, await LanguagesService.defaultCode());
      const changes = await regenerate(product, input.options);
      removedVariantIds = changes.removed;
      rewrittenVariantIds = changes.rewritten;
      product.options = input.options;
    }
    if (userId) product.updatedBy = new mongoose.Types.ObjectId(userId);
    await product.save();
    const detail = await ProductsService.get(id);
    const created = detail.variants.map((v) => v.id).filter((vid) => !before.has(vid));
    emitProductEvent(WebhookEvent.PRODUCT_UPDATED, product, [...created, ...rewrittenVariantIds, ...(removedVariantIds ?? [])]);
    return removedVariantIds ? { ...detail, removedVariantIds } : detail;
  }

  static async remove(id: string): Promise<{ variantIds: string[]; product: IProduct }> {
    const product = await load(id);
    const variantIds = (await VariantModel.find({ productId: product._id }).select('_id').lean()).map((v) => String(v._id));
    await VariantModel.deleteMany({ productId: product._id });
    await product.deleteOne();
    await ContentEntryModel.deleteMany({ itemId: product.itemId });
    await deleteDigitalFile(product);
    emitProductEvent(WebhookEvent.PRODUCT_DELETED, product, variantIds);
    return { variantIds, product };
  }

  static async list(options: ListProductsOptions = {}) {
    const { page = 1, limit = 20, search, type, status, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    const contentTypeId = await productContentTypeId();
    const filter: Record<string, unknown> = {};
    if (type) filter.type = type;
    if (status === 'active') filter.active = true;
    if (status === 'inactive') filter.active = false;
    const published = await ContentEntryModel.distinct('itemId', { contentTypeId, status: ContentStatus.PUBLISHED });
    if (status === 'unpublished') filter.itemId = { $nin: published };
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: 'i' };
      const [byName, bySku] = await Promise.all([
        ContentEntryModel.distinct('itemId', { contentTypeId, title: regex }),
        VariantModel.distinct('productId', { sku: regex }),
      ]);
      filter.$or = [{ itemId: { $in: byName } }, { _id: { $in: bySku } }];
    }
    const direction = sortOrder === 'asc' ? 1 : -1;
    const [products, total] = await Promise.all([
      ProductModel.find(filter).sort({ [sortBy]: direction }).skip((page - 1) * limit).limit(limit).exec(),
      ProductModel.countDocuments(filter),
    ]);
    const settings = await SettingsService.get();
    const currency = settings.defaultCurrency;
    const variants = await VariantModel.find({ productId: { $in: products.map((p) => p._id) } }).lean();
    const named = await names(products.map((p) => p.itemId));
    const publishedSet = new Set(published.map(String));
    const items: ProductListItem[] = products.map((p) => {
      const own = variants.filter((v) => String(v.productId) === String(p._id));
      const prices = currency ? own.map((v) => v.prices?.[currency]).filter((n): n is number => typeof n === 'number') : [];
      const tracked = own.filter((v) => v.active && v.stock?.tracked);
      const stock = tracked.length && tracked.every((v) => v.stock.quantity === 0) ? 'out' : tracked.some((v) => v.stock.quantity > 0 && v.stock.quantity <= LOW_STOCK) ? 'low' : null;
      return {
        id: String(p._id),
        itemId: String(p.itemId),
        type: p.type,
        active: p.active,
        name: named.get(String(p.itemId))?.name ?? '',
        published: publishedSet.has(String(p.itemId)),
        variantsCount: own.length,
        priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
        stock,
      };
    });
    return { products: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

/** Keep variants whose combination still exists, add missing ones, remove the rest. Returns removed ids. */
async function regenerate(product: IProduct, options: ProductOption[]): Promise<{ removed: string[]; rewritten: string[] }> {
  const existing = await VariantModel.find({ productId: product._id }).sort({ createdAt: 1 }).exec();
  const wanted = combinations(options);
  const keys = options.map((o) => o.key);
  // Keep only current options; an option the variant has no value for yet takes its first value,
  // so adding an option turns existing variants into its first combinations instead of removing them.
  const project = (values: Record<string, string>) => ({
    ...Object.fromEntries(options.map((o) => [o.key, o.values[0]?.key])),
    ...Object.fromEntries(Object.entries(values ?? {}).filter(([k]) => keys.includes(k))),
  });
  const kept = new Set<string>();
  const removed: string[] = [];
  const rewritten: string[] = [];
  for (const v of existing) {
    const projected = project(v.optionValues);
    const match = wanted.find((w) => sameCombo(w, projected));
    const duplicate = match && existing.some((o) => o !== v && kept.has(String(o._id)) && sameCombo(project(o.optionValues), match));
    if (match && !duplicate) {
      kept.add(String(v._id));
      if (!sameCombo(v.optionValues ?? {}, match)) {
        v.optionValues = match;
        v.markModified('optionValues');
        await v.save();
        rewritten.push(String(v._id));
      }
    } else {
      removed.push(String(v._id));
    }
  }
  // Remove first so new combinations can reuse SKUs of removed variants.
  if (removed.length) await VariantModel.deleteMany({ _id: { $in: removed } });
  const template = existing.find((v) => kept.has(String(v._id))) ?? existing[0];
  const baseSku = template?.sku ?? 'PRODUCT';
  const keptCombos = existing.filter((v) => kept.has(String(v._id))).map((v) => project(v.optionValues));
  const taken: string[] = [];
  for (const combo of wanted) {
    if (keptCombos.some((k) => sameCombo(k, combo))) continue;
    const suffix = Object.values(combo).join('-').toUpperCase();
    const sku = await uniqueSku(suffix ? `${baseSku}-${suffix}`.slice(0, 64) : baseSku, taken);
    taken.push(sku);
    await VariantModel.create({
      productId: product._id,
      sku,
      optionValues: combo,
      prices: { ...(template?.prices ?? {}) },
      weightGrams: template?.weightGrams ?? 0,
      stock: { tracked: product.type === ProductType.PHYSICAL, quantity: 0 },
    });
  }
  return { removed, rewritten };
}
