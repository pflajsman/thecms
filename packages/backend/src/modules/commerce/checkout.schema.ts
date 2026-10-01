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

const address = z.object({
  name: z.string().trim().min(1).max(100),
  company: z.string().trim().max(100).optional(),
  street: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((c) => c.toUpperCase()),
  vatId: z.string().trim().max(30).optional(),
});

export const orderBody = quoteBody.extend({
  customer: z.object({
    email: z.string().trim().email().max(200),
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().max(30).optional(),
  }),
  billingAddress: address,
  shippingAddress: address.optional(),
  note: z.string().trim().max(1000).optional(),
  acceptTerms: z.boolean().optional(),
  expectedTotal: z.number().int().min(0),
});
export const orderSchema = z.object({ body: orderBody });
export type OrderInput = z.infer<typeof orderBody>;
