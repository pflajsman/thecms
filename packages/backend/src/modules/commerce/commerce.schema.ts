import { z } from 'zod';

const currency = z.object({ code: z.string().regex(/^[A-Z]{3}$/), decimals: z.number().int().min(0).max(3) });
const vatRate = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(50),
  rate: z.number().int().min(0).max(10000),
});

const bankAccount = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    accountNumber: z.string().trim().min(1).max(40).optional(),
    iban: z.string().trim().toUpperCase().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/).optional(),
    bic: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/).optional(),
    holder: z.string().trim().min(1).max(100),
  })
  .refine((a) => a.accountNumber || a.iban, { message: 'Add an account number or an IBAN' });

// Checkout fields are optional: a save that leaves them out keeps the stored values.
export const settingsBody = z
  .object({
    currencies: z.array(currency).max(20),
    defaultCurrency: z.string().optional(),
    vatRates: z.array(vatRate).max(20),
    bankAccounts: z.array(bankAccount).max(20).optional(),
    unpaidCancelDays: z.number().int().min(1).max(90).optional(),
    downloadDays: z.number().int().min(1).max(365).optional(),
    downloadLimit: z.number().int().min(1).max(100).optional(),
    shopEmail: z.string().trim().email().optional(),
    termsUrl: z.string().trim().url().refine((u) => /^https?:\/\//.test(u), 'Use an http or https link').optional(),
  })
  .superRefine((s, ctx) => {
    const accounts = (s.bankAccounts ?? []).map((a) => a.currency);
    if (new Set(accounts).size !== accounts.length) ctx.addIssue({ code: 'custom', path: ['bankAccounts'], message: 'One bank account per currency' });
    if (accounts.some((c) => !s.currencies.some((x) => x.code === c)))
      ctx.addIssue({ code: 'custom', path: ['bankAccounts'], message: 'Bank accounts must use a configured currency' });
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

const country = z.string().trim().regex(/^[A-Za-z]{2}$/, 'Use a two-letter country code such as CZ');
const objectIdString = z.string().regex(/^[a-f0-9]{24}$/i);
const moneyMap = z.record(z.number().int().min(0).max(1_000_000_000));

export const zoneBody = z.object({
  name: z.string().trim().min(1).max(50),
  countries: z.array(country).max(250).default([]),
  rest: z.boolean().default(false),
});
export const zoneSchema = z.object({ body: zoneBody });
export const zoneUpdateSchema = z.object({ params: z.object({ id: objectIdString }), body: zoneBody });

export const methodBody = z.object({
  labels: z.record(z.string().trim().min(1).max(100)),
  active: z.boolean().default(true),
  paymentMethods: z.array(z.enum(['BANK_TRANSFER', 'CASH_ON_DELIVERY'])).min(1).max(2),
  codFees: moneyMap.default({}),
  freeOver: moneyMap.default({}),
  rates: z
    .array(
      z.object({
        zoneId: objectIdString,
        bands: z.array(z.object({ upToGrams: z.number().int().min(1).max(1_000_000).nullable(), prices: moneyMap })).min(1).max(20),
      })
    )
    .min(1)
    .max(50),
});
export const methodSchema = z.object({ body: methodBody });
export const methodUpdateSchema = z.object({ params: z.object({ id: objectIdString }), body: methodBody });
export type ZoneInput = z.infer<typeof zoneBody>;
export type MethodInput = z.infer<typeof methodBody>;


const ORDER_STATUSES = ['PLACED', 'COMPLETED', 'CANCELLED'] as const;
export const listOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(['UNPAID', 'PAID', 'REFUNDED']).optional(),
    fulfilmentStatus: z.enum(['UNFULFILLED', 'SHIPPED']).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});
export const shippedSchema = z.object({
  body: z.object({ trackingNumber: z.string().trim().max(100).optional(), trackingUrl: z.string().trim().url().optional() }),
});
export const cancelSchema = z.object({ body: z.object({ refunded: z.boolean().optional() }) });
export const resendSchema = z.object({ body: z.object({ what: z.enum(['confirmation', 'downloads']) }) });
export const noteSchema = z.object({ body: z.object({ note: z.string().max(2000) }) });
