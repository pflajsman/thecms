import { useTranslation } from 'react-i18next'
import { formatAbsolute } from '@/lib/format'
import type { OrderHistoryEntry } from '../../orders-api'

const KNOWN = ['placed', 'paid', 'shipped', 'delivered-digital', 'cancelled', 'email-sent', 'email-failed', 'resent'] as const
type Known = (typeof KNOWN)[number]

export function OrderHistory({ history }: { history: OrderHistoryEntry[] }) {
  const { t } = useTranslation('orders')
  const label = (entry: OrderHistoryEntry) => {
    const text = (KNOWN as readonly string[]).includes(entry.type) ? t(`historyTypes.${entry.type as Known}`) : entry.type
    return entry.by === 'system' ? t('order.historyBy', { label: text, by: t('automatically') }) : text
  }
  return (
    <section aria-labelledby="order-history" className="min-w-0 space-y-3">
      <h2 id="order-history" className="font-serif text-xl font-semibold">{t('order.history')}</h2>
      <ol className="flex flex-col divide-y rounded-xl border bg-card">
        {[...history].reverse().map((entry, i) => (
          <li key={i} className="px-4 py-2.5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{label(entry)}</span>
              <span className="text-xs text-muted-foreground">{formatAbsolute(entry.at)}</span>
            </div>
            {entry.detail && <p className="break-words text-muted-foreground">{entry.detail}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}
