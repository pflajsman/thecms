import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ShoppingBag } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { DataList, type DataColumn } from '@/components/common/DataList'
import { Pager } from '@/components/common/Pager'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import type { ProductListItem, ProductStatusFilter, ProductType, ShopCurrency } from '../commerce-api'
import { useProducts, useShopSettings } from '../commerce-queries'
import { formatMoney } from '../money'
import { NewProductButton } from '../components/NewProductDialog'
import { ShopSetupPrompt } from '../components/ShopSetupPrompt'

const PAGE_SIZE = 20
const ANY = 'any'
const TYPES: ProductType[] = ['PHYSICAL', 'DIGITAL']
const STATUSES: ProductStatusFilter[] = ['active', 'inactive', 'unpublished']

function useListParams() {
  const [sp, setSp] = useSearchParams()
  const params = useMemo(() => {
    const type = sp.get('type') as ProductType | null
    const status = sp.get('status') as ProductStatusFilter | null
    const page = Number(sp.get('page'))
    return {
      q: sp.get('q')?.trim().slice(0, 100) || undefined,
      type: type && TYPES.includes(type) ? type : undefined,
      status: status && STATUSES.includes(status) ? status : undefined,
      page: Number.isInteger(page) && page > 1 ? page : 1,
    }
  }, [sp])
  const update = (patch: Partial<typeof params>) => {
    const next = { ...params, ...patch, page: patch.page ?? 1 }
    const out = new URLSearchParams()
    if (next.q) out.set('q', next.q)
    if (next.type) out.set('type', next.type)
    if (next.status) out.set('status', next.status)
    if (next.page > 1) out.set('page', String(next.page))
    setSp(out, { replace: true })
  }
  return [params, update] as const
}

export function ProductsListPage() {
  const { t, i18n } = useTranslation('commerce')
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

  const ready = !!settings.data && settings.data.currencies.length > 0 && settings.data.vatRates.length > 0
  const list = useProducts({ search: params.q, type: params.type, status: params.status, page: params.page, limit: PAGE_SIZE })
  const currency = settings.data?.currencies.find((c) => c.code === settings.data?.defaultCurrency)

  const columns: DataColumn<ProductListItem>[] = [
    { id: 'name', header: t('products.columns.name'), cell: (p) => <NameLink product={p} /> },
    { id: 'type', header: t('products.type'), cell: (p) => <span className="text-muted-foreground">{t(`types.${p.type}`)}</span>, className: 'w-28' },
    { id: 'variants', header: t('products.columns.variants'), cell: (p) => p.variantsCount, className: 'w-24' },
    { id: 'price', header: t('products.columns.price'), cell: (p) => <PriceRange product={p} currency={currency} language={i18n.language} />, className: 'w-48 whitespace-nowrap' },
    { id: 'stock', header: t('products.columns.stock'), cell: (p) => <StockBadge product={p} />, className: 'w-32' },
    { id: 'status', header: t('products.status'), cell: (p) => <StatusBadge product={p} />, className: 'w-32' },
  ]

  let body: React.ReactNode
  if (settings.isPending) body = <Skeleton className="h-40 w-full" />
  else if (settings.isError) body = <ErrorState message={t('settings.loadError')} onRetry={() => void settings.refetch()} />
  else if (!ready) body = <ShopSetupPrompt />
  else if (list.isPending) body = <Skeleton className="h-40 w-full" />
  else if (list.isError) body = <ErrorState message={t('products.loadError')} onRetry={() => void list.refetch()} />
  else if (list.data.data.length === 0)
    body = <EmptyState icon={ShoppingBag} title={t('products.emptyTitle')} description={t('products.emptyText')} action={<NewProductButton />} />
  else
    body = (
      <>
        <DataList
          caption={t('products.tableLabel')}
          rows={list.data.data}
          columns={columns}
          rowKey={(p) => p.id}
          mobileRow={(p) => (
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <NameLink product={p} />
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`types.${p.type}`)} · <PriceRange product={p} currency={currency} language={i18n.language} />
                </p>
              </div>
              <StockBadge product={p} />
              <StatusBadge product={p} />
            </div>
          )}
        />
        <Pager page={params.page} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={(page) => update({ page })} />
      </>
    )

  return (
    <>
      <PageHeader title={t('products.title')} description={t('products.description')} actions={ready ? <NewProductButton /> : undefined} />
      {ready && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label={t('products.search')} placeholder={t('products.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-full pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={params.type ?? ANY} onValueChange={(v) => update({ type: v === ANY ? undefined : (v as ProductType) })}>
              <SelectTrigger aria-label={t('products.type')} className="w-auto min-w-36 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t('products.anyType')}</SelectItem>
                {TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{t(`types.${type}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={params.status ?? ANY} onValueChange={(v) => update({ status: v === ANY ? undefined : (v as ProductStatusFilter) })}>
              <SelectTrigger aria-label={t('products.status')} className="w-auto min-w-36 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t('products.anyStatus')}</SelectItem>
                <SelectItem value="active">{t('products.active')}</SelectItem>
                <SelectItem value="inactive">{t('products.inactive')}</SelectItem>
                <SelectItem value="unpublished">{t('products.unpublished')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {body}
    </>
  )
}

function NameLink({ product }: { product: ProductListItem }) {
  const { t } = useTranslation('commerce')
  return (
    <Link to={`/commerce/products/${product.id}`} className="font-serif text-base font-semibold hover:underline">
      {product.name || t('product.untitled')}
    </Link>
  )
}

function PriceRange({ product, currency, language }: { product: ProductListItem; currency?: ShopCurrency; language: string }) {
  if (!product.priceRange || !currency) return <span className="text-muted-foreground">–</span>
  const { min, max } = product.priceRange
  const text = min === max ? formatMoney(min, currency, language) : `${formatMoney(min, currency, language)} – ${formatMoney(max, currency, language)}`
  return <span>{text}</span>
}

function StockBadge({ product }: { product: ProductListItem }) {
  const { t } = useTranslation('commerce')
  if (product.stock === 'out') return <Badge variant="destructive">{t('products.outOfStock')}</Badge>
  if (product.stock === 'low') return <Badge variant="secondary">{t('products.lowStock')}</Badge>
  return null
}

function StatusBadge({ product }: { product: ProductListItem }) {
  const { t } = useTranslation('commerce')
  if (!product.published) return <Badge variant="outline">{t('products.unpublished')}</Badge>
  return <Badge variant={product.active ? 'default' : 'outline'}>{product.active ? t('products.active') : t('products.inactive')}</Badge>
}
