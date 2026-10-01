import { z } from 'zod';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
export const quoteBody = z.object({
  currency: z.string().optional(),
  language: z.string().optional(),
  items: z.array(z.object({ variantId: objectId, quantity: z.number().int().min(1).max(99) })).min(1).max(50),
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  shippingMethodId: objectId.optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH_ON_DELIVERY']).optional(),
});
export const quoteSchema = z.object({ body: quoteBody });
