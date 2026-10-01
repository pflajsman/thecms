import crypto from 'crypto';
import mongoose from 'mongoose';
import { OrderModel, type IOrder } from '../../models/order.model';
import { CounterModel } from '../../models/counter.model';
import { VariantModel } from '../../models/variant.model';
import { AppError } from '../../middleware/error.middleware';
import type { IShopSettings } from '../../models/shop-settings.model';
import { SettingsService } from './settings.service';
import { quote } from './pricing-context';
import type { Quote } from './pricing';
import { providers, type PaymentInstructions } from './payments';
import type { OrderInput } from './checkout.schema';
import { resolveLanguage } from '../public/public-content.service';
import { emitOrderEvent } from './order-events';
import { notify } from './order-emails';
import { WebhookEvent } from '../../models/webhook.model';

export async function nextOrderNumber(date = new Date()): Promise<string> {
  const year = date.getUTCFullYear();
  const counter = await CounterModel.findOneAndUpdate({ _id: `order-${year}` }, { $inc: { value: 1 } }, { upsert: true, new: true });
  return `${year}${String(counter!.value).padStart(6, '0')}`;
}

/** Decrement tracked stock line by line; undo what was taken if any line cannot be served. */
export async function reserveStock(lines: { variantId: string; quantity: number }[]): Promise<void> {
  const taken: { variantId: string; quantity: number }[] = [];
  for (const line of lines) {
    const variant = await VariantModel.findById(line.variantId).select('stock').lean();
    if (!variant?.stock?.tracked) continue;
    const updated = await VariantModel.findOneAndUpdate(
      { _id: line.variantId, 'stock.tracked': true, 'stock.quantity': { $gte: line.quantity } },
      { $inc: { 'stock.quantity': -line.quantity } },
      { new: true }
    );
    if (!updated) {
      await releaseStock(taken);
      throw new AppError('Some items are no longer in stock', 409, { reason: 'OUT_OF_STOCK', lines: [line.variantId] });
    }
    taken.push(line);
  }
}

export async function releaseStock(lines: { variantId: string; quantity: number }[]): Promise<void> {
  for (const line of lines) {
    await VariantModel.updateOne({ _id: line.variantId, 'stock.tracked': true }, { $inc: { 'stock.quantity': line.quantity } });
  }
}

/** Called after an order is saved: webhook now, emails in the order emails module. */
export function onOrderPlaced(order: IOrder): void {
  void notify(order, 'confirmation');
  emitOrderEvent(WebhookEvent.ORDER_PLACED, order);
}

const STOCK_PROBLEMS = new Set(['OUT_OF_STOCK', 'NOT_ENOUGH_STOCK']);

function assertOrderable(q: Quote, input: OrderInput, settings: IShopSettings): void {
  const badLines = q.lines.filter((l) => l.problem);
  if (badLines.length) {
    if (badLines.every((l) => STOCK_PROBLEMS.has(l.problem!))) {
      throw new AppError('Some items are no longer in stock', 409, { reason: 'OUT_OF_STOCK', lines: badLines.map((l) => l.variantId), quote: q });
    }
    throw new AppError('Some items cannot be ordered', 400, { reason: 'LINES', lines: badLines.map((l) => ({ variantId: l.variantId, problem: l.problem })) });
  }
  if (settings.termsUrl && input.acceptTerms !== true) throw new AppError('Accept the terms and conditions', 400, { reason: 'TERMS' });
  if (q.hasPhysical) {
    if (q.problems.includes('NO_SHIPPING')) throw new AppError('We do not ship to this country', 400, { reason: 'NO_SHIPPING' });
    if (!input.shippingAddress || !q.shipping) throw new AppError('Choose shipping and enter a shipping address', 400, { reason: 'SHIPPING_REQUIRED' });
    if (input.shippingAddress.country !== input.country?.toUpperCase())
      throw new AppError('The shipping address country does not match the shipping country', 400, { reason: 'SHIPPING_REQUIRED' });
  }
  if (q.problems.includes('PAYMENT_NOT_ALLOWED')) throw new AppError('This payment method is not available', 400, { reason: 'PAYMENT_NOT_ALLOWED' });
  if (!q.payment) throw new AppError('Choose a payment method', 400, { reason: 'PAYMENT_REQUIRED' });
}

export async function placeOrder(
  input: OrderInput,
  opts: { idempotencyKey?: string; siteId?: string; skipHooks?: boolean } = {}
): Promise<{ order: IOrder; instructions?: PaymentInstructions; replay: boolean }> {
  const settings = await SettingsService.get();
  const siteId = opts.siteId && mongoose.Types.ObjectId.isValid(opts.siteId) ? opts.siteId : undefined;
  // Keys are unique per site key, so two storefronts cannot collide.
  const idempotencyKey = opts.idempotencyKey ? `${siteId ?? 'none'}:${opts.idempotencyKey}` : undefined;
  const replay = async () => {
    if (!idempotencyKey) return undefined;
    const existing = await OrderModel.findOne({ idempotencyKey });
    if (!existing) return undefined;
    if (existing.customer.email.toLowerCase() !== input.customer.email.toLowerCase() || existing.totals.total !== input.expectedTotal) {
      throw new AppError('This Idempotency-Key was already used for a different order', 422, { reason: 'IDEMPOTENCY_KEY_REUSED' });
    }
    return { order: existing, instructions: providers[existing.payment.method].instructions(existing, settings), replay: true };
  };
  const earlier = await replay();
  if (earlier) return earlier;

  const q = await quote(input);
  try {
    assertOrderable(q, input, settings);
    if (q.totals.total !== input.expectedTotal) {
      throw new AppError('Prices changed; please review your order', 409, { reason: 'PRICE_CHANGED', quote: q });
    }
    await reserveStock(q.lines);
  } catch (error) {
    // A retry that arrives while the first request is still placing the order sees its stock already taken.
    if (error instanceof AppError && error.statusCode === 409 && idempotencyKey) {
      for (let i = 0; i < 5; i++) {
        const inFlight = await replay();
        if (inFlight) return inFlight;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw error;
  }
  let order: IOrder;
  try {
    const number = await nextOrderNumber();
    order = await OrderModel.create({
      number,
      accessToken: crypto.randomBytes(32).toString('base64url'),
      currency: q.currency,
      language: (await resolveLanguage(input.language)).language,
      customer: input.customer,
      billingAddress: input.billingAddress,
      shippingAddress: q.hasPhysical ? input.shippingAddress : undefined,
      note: input.note,
      lines: q.lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        itemId: l.itemId,
        sku: l.sku,
        name: l.name,
        optionLabels: l.optionLabels,
        type: l.type,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        vatRate: l.vatRate,
        lineTotal: l.lineTotal,
        weightGrams: l.weightGrams,
      })),
      shipping: q.shipping,
      payment: { method: q.payment!.method, fee: q.payment!.fee, reference: number },
      totals: q.totals,
      history: [{ at: new Date(), type: 'placed' }],
      idempotencyKey,
      siteId,
    });
  } catch (error) {
    await releaseStock(q.lines);
    // A concurrent retry with the same key won the insert: return its order.
    if ((error as { code?: number }).code === 11000 && idempotencyKey) {
      const existing = await replay();
      if (existing) return existing;
    }
    throw error;
  }
  if (!opts.skipHooks) onOrderPlaced(order);
  return { order, instructions: providers[order.payment.method].instructions(order, settings), replay: false };
}

/** The order as the customer's thank-you page sees it. */
export function publicOrderView(order: IOrder, settings: IShopSettings) {
  return {
    number: order.number,
    createdAt: order.createdAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    currency: order.currency,
    lines: order.lines.map((l) => ({ name: l.name, optionLabels: l.optionLabels, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, type: l.type })),
    shipping: order.shipping,
    payment: {
      method: order.payment.method,
      fee: order.payment.fee,
      instructions: order.paymentStatus === 'UNPAID' && order.status === 'PLACED' ? providers[order.payment.method].instructions(order, settings) : undefined,
    },
    totals: order.totals,
    tracking: order.tracking,
  };
}

export async function findOrderForCustomer(number: string, token: unknown): Promise<IOrder | null> {
  if (typeof token !== 'string' || !/^\d{10}$/.test(number)) return null;
  const order = await OrderModel.findOne({ number });
  if (!order) return null;
  const a = Buffer.from(order.accessToken);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? order : null;
}
