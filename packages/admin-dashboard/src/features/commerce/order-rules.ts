import type { Order } from './orders-api'

export interface OrderActionSet {
  markPaid: boolean
  ship: boolean
  cancel: boolean
  resendConfirmation: boolean
  resendDownloads: boolean
}

/** Mirrors the backend guards, so the page offers only actions the server accepts. */
export function availableActions(order: Pick<Order, 'status' | 'paymentStatus' | 'fulfilmentStatus'> & { lines: Pick<Order['lines'][number], 'type'>[] }): OrderActionSet {
  const open = order.status === 'PLACED'
  const live = order.status !== 'CANCELLED'
  const physical = order.lines.some((l) => l.type === 'PHYSICAL')
  const digital = order.lines.some((l) => l.type === 'DIGITAL')
  return {
    markPaid: open && order.paymentStatus === 'UNPAID',
    ship: open && physical && order.fulfilmentStatus === 'UNFULFILLED',
    cancel: open,
    resendConfirmation: live,
    resendDownloads: live && digital && order.paymentStatus === 'PAID',
  }
}
