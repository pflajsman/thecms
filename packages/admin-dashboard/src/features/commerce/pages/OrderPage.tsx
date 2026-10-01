import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAbsolute } from '@/lib/format'
import { useOrder } from '../orders-queries'
import { useShopSettings } from '../commerce-queries'
import { currencyFor } from '../money'
import { FulfilmentBadge, OrderStatusBadge, PaymentBadge } from '../components/OrderBadges'
import { OrderLines } from '../components/order/OrderLines'
import { OrderDetails } from '../components/order/OrderDetails'
import { OrderHistory } from '../components/order/OrderHistory'
import { OrderActions } from '../components/order/OrderActions'
import { InternalNote } from '../components/order/InternalNote'

export function OrderPage() {
  const { id } = useParams()
  const { t } = useTranslation('orders')
  const order = useOrder(id)
  const settings = useShopSettings()

  if (order.isError) return <ErrorState message={t('order.loadError')} onRetry={() => void order.refetch()} />
  if (order.isPending) return <Skeleton className="h-64 w-full" />

  const o = order.data
  const currency = currencyFor(o.currency, settings.data?.currencies ?? [])
  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/commerce/orders" className="text-sm text-muted-foreground hover:underline">{t('order.back')}</Link>}
        title={t('order.title', { number: o.number })}
        description={t('order.placedAt', { date: formatAbsolute(o.createdAt) })}
        actions={<OrderActions order={o} />}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <OrderStatusBadge status={o.status} />
        <PaymentBadge status={o.paymentStatus} />
        <FulfilmentBadge status={o.fulfilmentStatus} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <OrderLines order={o} currency={currency} />
          <OrderHistory history={o.history} />
        </div>
        <div className="min-w-0 space-y-4">
          <OrderDetails order={o} currency={currency} />
          {/* Keyed by the stored note so a reload after an action shows the saved text. */}
          <InternalNote key={o.internalNote ?? ''} order={o} />
        </div>
      </div>
    </>
  )
}
