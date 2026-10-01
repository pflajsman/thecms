import { z } from 'zod';

const currency = z.object({ code: z.string().regex(/^[A-Z]{3}$/), decimals: z.number().int().min(0).max(3) });
const vatRate = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(50),
  rate: z.number().int().min(0).max(10000),
});

export const settingsBody = z
  .object({ currencies: z.array(currency).max(20), defaultCurrency: z.string().optional(), vatRates: z.array(vatRate).max(20) })
  .superRefine((s, ctx) => {
    const codes = s.currencies.map((c) => c.code);
    if (new Set(codes).size !== codes.length) ctx.addIssue({ code: 'custom', path: ['currencies'], message: 'Currency codes must be unique' });
    const ids = s.vatRates.map((r) => r.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['vatRates'], message: 'VAT rate ids must be unique' });
    if (codes.length > 0 && (!s.defaultCurrency || !codes.includes(s.defaultCurrency)))
      ctx.addIssue({ code: 'custom', path: ['defaultCurrency'], message: 'Choose a default currency from the list' });
  });
export const settingsSchema = z.object({ body: settingsBody });
export type SettingsInput = z.infer<typeof settingsBody>;

const KEY = /^[a-z][a-z0-9-]{0,39}$/;
const labels = z.record(z.string().trim().min(1).max(100));
const optionValue = z.object({ key: z.string().regex(KEY), labels });
const option = z.object({ key: z.string().regex(KEY), labels, values: z.array(optionValue).min(1).max(50) });

export const createProductSchema = z.object({
  body: z.object({ name: z.string().trim().min(1).max(200), type: z.enum(['PHYSICAL', 'DIGITAL']) }),
});
export const updateProductSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    vatRateId: z.string().optional(),
    active: z.boolean().optional(),
    options: z.array(option).max(3).optional(),
  }),
});
const variantInput = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1).max(64),
  optionValues: z.record(z.string()).default({}),
  prices: z.record(z.number().int().min(0)).default({}),
  weightGrams: z.number().int().min(0).default(0),
  stock: z.object({ tracked: z.boolean(), quantity: z.number().int().min(0) }).default({ tracked: false, quantity: 0 }),
  active: z.boolean().default(true),
});
export const variantsSchema = z.object({ params: z.object({ id: z.string() }), body: z.object({ variants: z.array(variantInput).min(1).max(500) }) });
export type VariantInput = z.infer<typeof variantInput>;
export type ProductOptionInput = z.infer<typeof option>;
export const listProductsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    type: z.enum(['PHYSICAL', 'DIGITAL']).optional(),
    status: z.enum(['active', 'inactive', 'unpublished']).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});
