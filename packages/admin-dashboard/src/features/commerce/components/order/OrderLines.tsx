import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { Order } from '../../orders-api'
import { formatMoney } from '../../money'

export function OrderLines({ order, currency }: { order: Order; currency: { code: string; decimals: number } }) {
  const { t, i18n } = useTranslation('orders')
  const money = (minor: number) => formatMoney(minor, currency, i18n.language)
  const percent = (rate: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(rate / 100)
  const row = 'flex items-baseline justify-between gap-4'

  return (
    <section aria-labelledby="order-items" className="min-w-0 space-y-3">
      <h2 id="order-items" className="font-serif text-xl font-semibold">{t('order.items')}</h2>
      <ul aria-label={t('order.linesLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
        {order.lines.map((line, i) => (
          <li key={i} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                {line.name}
                {line.type === 'DIGITAL' && <Badge variant="secondary" className="ml-2 align-middle">{t('order.digital')}</Badge>}
              </p>
              {line.optionLabels.map((o) => (
                <p key={o.option} className="text-sm text-muted-foreground">{t('order.option', { option: o.option, value: o.value })}</p>
              ))}
              <p className="font-mono text-xs text-muted-foreground">{t('order.sku', { sku: line.sku })}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">{t('order.quantityPrice', { quantity: line.quantity, price: money(line.unitPrice) })}</p>
              <p className="font-medium">{money(line.lineTotal)}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
        <dl className="space-y-1">
        <div className={row}>
          <dt>{t('order.itemsTotal')}</dt>
          <dd>{money(order.totals.items)}</dd>
        </div>
        {order.shipping && (
          <div className={row}>
            <dt>{t('order.shippingTotal', { name: order.shipping.name })}</dt>
            <dd>{money(order.totals.shipping)}</dd>
          </div>
        )}
        {order.totals.paymentFee > 0 && (
          <div className={row}>
            <dt>{t('order.paymentFee')}</dt>
            <dd>{money(order.totals.paymentFee)}</dd>
          </div>
        )}
        <div className={`${row} border-t pt-2 text-base font-semibold`}>
          <dt>{t('order.total')}</dt>
          <dd>{money(order.totals.total)}</dd>
        </div>
        </dl>
        {order.totals.vat.map((v) => (
          <p key={v.rate} className="text-xs text-muted-foreground">
            {t('order.vatLine', { rate: percent(v.rate), amount: money(v.amount), base: money(v.base) })}
          </p>
        ))}
      </div>
    </section>
  )
}
