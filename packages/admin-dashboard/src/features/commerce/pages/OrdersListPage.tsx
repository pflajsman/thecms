import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ReceiptText, Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { DataList, type DataColumn } from '@/components/common/DataList'
import { Pager } from '@/components/common/Pager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { formatAbsolute } from '@/lib/format'
import {
  FULFILMENT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type FulfilmentStatus,
  type OrderListItem,
  type OrderStatus,
  type PaymentStatus,
} from '../orders-api'
import { useOrders } from '../orders-queries'
import { useShopSettings } from '../commerce-queries'
import { currencyFor, formatMoney } from '../money'
import { FulfilmentBadge, OrderStatusBadge, PaymentBadge } from '../components/OrderBadges'

const PAGE_SIZE = 20
const ANY = 'any'

function pick<T extends string>(value: string | null, allowed: T[]): T | undefined {
  return value && (allowed as string[]).includes(value) ? (value as T) : undefined
}

function useListParams() {
  const [sp, setSp] = useSearchParams()
  const params = useMemo(() => {
    const page = Number(sp.get('page'))
    return {
      q: sp.get('q')?.trim().slice(0, 100) || undefined,
      status: pick<OrderStatus>(sp.get('status'), ORDER_STATUSES),
      payment: pick<PaymentStatus>(sp.get('payment'), PAYMENT_STATUSES),
      shipping: pick<FulfilmentStatus>(sp.get('shipping'), FULFILMENT_STATUSES),
      action: sp.get('action') === '1',
      page: Number.isInteger(page) && page > 1 ? page : 1,
    }
  }, [sp])
  const update = (patch: Partial<typeof params>) => {
    const next = { ...params, ...patch, page: patch.page ?? 1 }
    const out = new URLSearchParams()
    if (next.q) out.set('q', next.q)
    if (next.status) out.set('status', next.status)
    if (next.payment) out.set('payment', next.payment)
    if (next.shipping) out.set('shipping', next.shipping)
    if (next.action) out.set('action', '1')
    if (next.page > 1) out.set('page', String(next.page))
    setSp(out, { replace: true })
  }
  return [params, update] as const
}

export function OrdersListPage() {
  const { t, i18n } = useTranslation('orders')
  const settings = useShopSettings()
  const [params, update] = useListParams()
  const [search, setSearch] = useState(params.q ?? '')
  const debounced = useDebouncedValue(search, 300)
  useEffect(() => {
    const next = debounced.trim() || undefined
    if (next !== params.q) update({ q: next })
    // Only react to the debounced text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const list = useOrders({
    search: params.q,
    status: params.status,
    paymentStatus: params.payment,
    fulfilmentStatus: params.shipping,
    needsAction: params.action,
    page: params.page,
    limit: PAGE_SIZE,
  })
  const filtered = !!(params.q || params.status || params.payment || params.shipping || params.action)
  const money = (o: OrderListItem) => formatMoney(o.total, currencyFor(o.currency, settings.data?.currencies ?? []), i18n.language)

  const columns: DataColumn<OrderListItem>[] = [
    { id: 'number', header: t('list.columns.number'), cell: (o) => <NumberLink order={o} />, className: 'w-32' },
    { id: 'date', header: t('list.columns.date'), cell: (o) => <span className="text-muted-foreground">{formatAbsolute(o.createdAt)}</span>, className: 'w-40 whitespace-nowrap' },
    { id: 'customer', header: t('list.columns.customer'), cell: (o) => <Customer order={o} /> },
    { id: 'total', header: t('list.columns.total'), cell: (o) => money(o), className: 'w-32 whitespace-nowrap' },
    { id: 'payment', header: t('list.columns.payment'), cell: (o) => <PaymentBadge status={o.paymentStatus} />, className: 'w-28' },
    { id: 'shipping', header: t('list.columns.shipping'), cell: (o) => <FulfilmentBadge status={o.fulfilmentStatus} />, className: 'w-28' },
    { id: 'status', header: t('list.columns.status'), cell: (o) => <OrderStatusBadge status={o.status} />, className: 'w-28' },
  ]

  let body: React.ReactNode
  if (list.isPending) body = <Skeleton className="h-40 w-full" />
  else if (list.isError) body = <ErrorState message={t('list.loadError')} onRetry={() => void list.refetch()} />
  else if (list.data.data.length === 0)
    body = filtered ? <p className="py-8 text-center text-sm text-muted-foreground">{t('list.noMatches')}</p> : <EmptyState icon={ReceiptText} title={t('list.emptyTitle')} description={t('list.emptyText')} />
  else
    body = (
      <>
        <DataList
          caption={t('list.tableLabel')}
          rows={list.data.data}
          columns={columns}
          rowKey={(o) => o.id}
          mobileRow={(o) => (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <NumberLink order={o} />
                <span className="text-sm font-medium">{money(o)}</span>
              </div>
              <Customer order={o} />
              <div className="flex flex-wrap gap-1.5">
                <PaymentBadge status={o.paymentStatus} />
                <FulfilmentBadge status={o.fulfilmentStatus} />
                <OrderStatusBadge status={o.status} />
              </div>
            </div>
          )}
        />
        <Pager page={params.page} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={(page) => update({ page })} />
      </>
    )

  return (
    <>
      <PageHeader title={t('list.title')} description={t('list.description')} />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label={t('list.search')} placeholder={t('list.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-full pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={params.action ? 'default' : 'outline'} className="rounded-full" aria-pressed={params.action} onClick={() => update({ action: !params.action })}>
            {t('list.needsAction')}
          </Button>
          <Select value={params.status ?? ANY} onValueChange={(v) => update({ status: v === ANY ? undefined : (v as OrderStatus) })}>
            <SelectTrigger aria-label={t('list.statusFilter')} className="w-auto min-w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('list.anyStatus')}</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={params.payment ?? ANY} onValueChange={(v) => update({ payment: v === ANY ? undefined : (v as PaymentStatus) })}>
            <SelectTrigger aria-label={t('list.paymentFilter')} className="w-auto min-w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('list.anyPayment')}</SelectItem>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`payment.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={params.shipping ?? ANY} onValueChange={(v) => update({ shipping: v === ANY ? undefined : (v as FulfilmentStatus) })}>
            <SelectTrigger aria-label={t('list.shippingFilter')} className="w-auto min-w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('list.anyShipping')}</SelectItem>
              {FULFILMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`fulfilment.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {body}
    </>
  )
}

function NumberLink({ order }: { order: OrderListItem }) {
  return (
    <Link to={`/commerce/orders/${order.id}`} className="font-mono font-semibold hover:underline">
      {order.number}
    </Link>
  )
}

function Customer({ order }: { order: OrderListItem }) {
  return (
    <div className="min-w-0">
      <p className="truncate">{order.customer.name}</p>
      <p className="truncate text-xs text-muted-foreground">{order.customer.email}</p>
    </div>
  )
}
