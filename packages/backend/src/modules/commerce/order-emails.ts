import type { IOrder } from '../../models/order.model';

export type NotifyKind = 'confirmation' | 'paid' | 'shipped' | 'cancelled' | 'downloads';

/** Replaced by the order emails task; actions already call it. */
export async function notify(_order: IOrder, _kind: NotifyKind): Promise<void> {
  return;
}
