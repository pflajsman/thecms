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
