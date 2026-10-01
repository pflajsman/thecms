import { OrderModel } from '../../models/order.model';
import { AppError } from '../../middleware/error.middleware';
import { SettingsService } from './settings.service';
import { cancelOrder } from './order-actions';

/** Cancel unpaid bank transfer orders older than the shop's limit. Safe with several instances running it. */
export async function cancelStaleUnpaidOrders(now = new Date()): Promise<number> {
  const settings = await SettingsService.get();
  const before = new Date(now.getTime() - (settings.unpaidCancelDays ?? 14) * 24 * 3600_000);
  const candidates = await OrderModel.find({ status: 'PLACED', paymentStatus: 'UNPAID', 'payment.method': 'BANK_TRANSFER', createdAt: { $lt: before } })
    .select('_id')
    .lean();
  let cancelled = 0;
  for (const c of candidates) {
    try {
      // cancelOrder's conditional update lets only one runner cancel each order.
      await cancelOrder(String(c._id), { paymentStatus: 'UNPAID' }, { by: 'system', detail: 'unpaid' });
      cancelled++;
    } catch (error) {
      if (!(error instanceof AppError && error.statusCode === 409)) console.error('Unpaid order job:', error);
    }
  }
  return cancelled;
}

export function startUnpaidJob(intervalMs = 3_600_000): () => void {
  const run = () => cancelStaleUnpaidOrders().catch((err) => console.error('Unpaid order job failed:', err));
  const timer = setInterval(run, intervalMs);
  timer.unref();
  void run();
  return () => clearInterval(timer);
}
