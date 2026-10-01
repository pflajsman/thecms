import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { FulfilmentStatus, OrderStatus, PaymentStatus } from '../orders-api'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS: Record<OrderStatus, Variant> = { PLACED: 'outline', COMPLETED: 'default', CANCELLED: 'destructive' }
const PAYMENT: Record<PaymentStatus, Variant> = { UNPAID: 'outline', PAID: 'default', REFUNDED: 'secondary' }
const FULFILMENT: Record<FulfilmentStatus, Variant> = { UNFULFILLED: 'outline', SHIPPED: 'default' }

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation('orders')
  return <Badge variant={STATUS[status]}>{t(`status.${status}`)}</Badge>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation('orders')
  return <Badge variant={PAYMENT[status]}>{t(`payment.${status}`)}</Badge>
}

export function FulfilmentBadge({ status }: { status: FulfilmentStatus }) {
  const { t } = useTranslation('orders')
  return <Badge variant={FULFILMENT[status]}>{t(`fulfilment.${status}`)}</Badge>
}
