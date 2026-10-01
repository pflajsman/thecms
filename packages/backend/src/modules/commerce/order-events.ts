import type { IOrder } from '../../models/order.model';
import { WebhookEvent } from '../../models/webhook.model';
import { WebhookService } from '../../services/webhook.service';

type OrderEvent = WebhookEvent.ORDER_PLACED | WebhookEvent.ORDER_PAID | WebhookEvent.ORDER_SHIPPED | WebhookEvent.ORDER_CANCELLED;

export function emitOrderEvent(event: OrderEvent, order: IOrder): void {
  WebhookService.triggerEvent(event, {
    order: {
      id: String(order._id),
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfilmentStatus: order.fulfilmentStatus,
      total: order.totals.total,
      currency: order.currency,
    },
  }).catch((err) => console.error('Webhook trigger error:', err));
}
