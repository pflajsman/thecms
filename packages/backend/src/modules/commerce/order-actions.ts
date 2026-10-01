import mongoose from 'mongoose';
import { OrderModel, type IOrder } from '../../models/order.model';
import { WebhookEvent } from '../../models/webhook.model';
import { AppError } from '../../middleware/error.middleware';
import { escapeRegex } from '../../utils/regex';
import { SettingsService } from './settings.service';
import { releaseStock } from './orders.service';
import { emitOrderEvent } from './order-events';
import { expireGrants, issueGrants } from './downloads.service';
import { notify } from './order-emails';
import { providers } from './payments';

interface HistoryInput {
  type: string;
  by?: string;
  detail?: string;
}

/** Conditional update: only applies when the order still matches the guard, so concurrent actions cannot double-apply. */
async function transition(id: string, guard: Record<string, unknown>, update: Record<string, unknown>, history: HistoryInput): Promise<IOrder> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid order ID', 400);
  const order = await OrderModel.findOneAndUpdate(
    { _id: id, ...guard },
    { $set: update, $push: { history: { at: new Date(), ...history } } },
    { new: true }
  );
  if (!order) {
    if (!(await OrderModel.exists({ _id: id }))) throw new AppError('Order not found', 404);
    throw new AppError('This action is not possible for the order in its current state', 409);
  }
  return order;
}

async function completeIfDone(order: IOrder): Promise<IOrder> {
  if (order.paymentStatus === 'PAID' && order.fulfilmentStatus === 'SHIPPED' && order.status === 'PLACED') {
    return (await OrderModel.findOneAndUpdate({ _id: order._id, status: 'PLACED' }, { $set: { status: 'COMPLETED' } }, { new: true })) ?? order;
  }
  return order;
}

/** Cancel a placed order once: release its stock, expire downloads, email and fire the webhook. */
export async function cancelOrder(id: string, guard: Record<string, unknown>, opts: { refunded?: boolean; by?: string; detail?: string }): Promise<IOrder> {
  const current = await OrderModel.findById(id).select('paymentStatus').lean();
  const update: Record<string, unknown> = { status: 'CANCELLED' };
  if (opts.refunded && current?.paymentStatus === 'PAID') update.paymentStatus = 'REFUNDED';
  const order = await transition(id, { status: 'PLACED', ...guard }, update, { type: 'cancelled', by: opts.by, detail: opts.detail });
  await releaseStock(order.lines);
  await expireGrants(order);
  void notify(order, 'cancelled');
  emitOrderEvent(WebhookEvent.ORDER_CANCELLED, order);
  return order;
}

export const OrderActions = {
  async markPaid(id: string, by?: string): Promise<IOrder> {
    let order = await transition(id, { status: 'PLACED', paymentStatus: 'UNPAID' }, { paymentStatus: 'PAID' }, { type: 'paid', by });
    if (order.lines.some((l) => l.type === 'DIGITAL')) await issueGrants(order, await SettingsService.get());
    // A digital-only order is delivered by its download links.
    if (order.lines.every((l) => l.type === 'DIGITAL')) {
      order = await transition(id, { fulfilmentStatus: 'UNFULFILLED' }, { fulfilmentStatus: 'SHIPPED' }, { type: 'delivered-digital' });
    }
    order = await completeIfDone(order);
    void notify(order, 'paid');
    emitOrderEvent(WebhookEvent.ORDER_PAID, order);
    return order;
  },

  async markShipped(id: string, tracking: { trackingNumber?: string; trackingUrl?: string }, by?: string): Promise<IOrder> {
    const existing = await OrderModel.findById(id).select('payment paymentStatus lines.type').lean();
    if (existing && existing.lines.every((l) => l.type === 'DIGITAL')) {
      throw new AppError('Digital orders are delivered by their download links when they are paid', 409);
    }
    const update: Record<string, unknown> = { fulfilmentStatus: 'SHIPPED' };
    if (tracking.trackingNumber || tracking.trackingUrl) update.tracking = { number: tracking.trackingNumber, url: tracking.trackingUrl };
    // Cash on delivery is paid when the parcel is handed over.
    const cod = existing?.payment?.method === 'CASH_ON_DELIVERY' && existing.paymentStatus === 'UNPAID';
    if (cod) update.paymentStatus = 'PAID';
    let order = await transition(id, { status: 'PLACED', fulfilmentStatus: 'UNFULFILLED' }, update, { type: 'shipped', by, detail: tracking.trackingNumber });
    order = await completeIfDone(order);
    void notify(order, 'shipped');
    emitOrderEvent(WebhookEvent.ORDER_SHIPPED, order);
    if (cod) emitOrderEvent(WebhookEvent.ORDER_PAID, order);
    return order;
  },

  cancel(id: string, opts: { refunded?: boolean }, by?: string): Promise<IOrder> {
    return cancelOrder(id, {}, { refunded: opts.refunded, by });
  },

  async resend(id: string, what: 'confirmation' | 'downloads', by?: string): Promise<IOrder> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid order ID', 400);
    const order = await OrderModel.findById(id);
    if (!order) throw new AppError('Order not found', 404);
    if (what === 'downloads') {
      if (order.paymentStatus !== 'PAID' || !order.lines.some((l) => l.type === 'DIGITAL')) {
        throw new AppError('Only paid orders with digital items have downloads', 409);
      }
      await issueGrants(order, await SettingsService.get());
    }
    const updated = await transition(id, {}, {}, { type: 'resent', by, detail: what });
    void notify(updated, what);
    return updated;
  },

  async setInternalNote(id: string, note: string): Promise<IOrder> {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid order ID', 400);
    const order = await OrderModel.findByIdAndUpdate(id, { $set: { internalNote: note } }, { new: true });
    if (!order) throw new AppError('Order not found', 404);
    return order;
  },
};

export interface OrderListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  paymentStatus?: string;
  fulfilmentStatus?: string;
  sortOrder?: 'asc' | 'desc';
}

export const OrdersAdminService = {
  async list(opts: OrderListOptions = {}) {
    const { page = 1, limit = 20, search, status, paymentStatus, fulfilmentStatus, sortOrder = 'desc' } = opts;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (fulfilmentStatus) filter.fulfilmentStatus = fulfilmentStatus;
    if (search) {
      const text = escapeRegex(search.trim());
      filter.$or = [{ number: { $regex: `^${text}` } }, { 'customer.email': { $regex: text, $options: 'i' } }, { 'customer.name': { $regex: text, $options: 'i' } }];
    }
    const [orders, total] = await Promise.all([
      OrderModel.find(filter).sort({ createdAt: sortOrder === 'asc' ? 1 : -1 }).skip((page - 1) * limit).limit(limit).lean(),
      OrderModel.countDocuments(filter),
    ]);
    return {
      orders: orders.map((o) => ({
        id: String(o._id),
        number: o.number,
        createdAt: o.createdAt,
        customer: { name: o.customer.name, email: o.customer.email },
        total: o.totals.total,
        currency: o.currency,
        status: o.status,
        paymentStatus: o.paymentStatus,
        fulfilmentStatus: o.fulfilmentStatus,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async get(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid order ID', 400);
    const order = await OrderModel.findById(id);
    if (!order) throw new AppError('Order not found', 404);
    const settings = await SettingsService.get();
    const instructions = order.paymentStatus === 'UNPAID' && order.status === 'PLACED' ? providers[order.payment.method].instructions(order, settings) : undefined;
    return { ...order.toJSON(), instructions };
  },

  needsAction(): Promise<number> {
    return OrderModel.countDocuments({
      status: 'PLACED',
      fulfilmentStatus: 'UNFULFILLED',
      $or: [{ paymentStatus: 'PAID' }, { 'payment.method': 'CASH_ON_DELIVERY' }],
    }).exec();
  },
};
