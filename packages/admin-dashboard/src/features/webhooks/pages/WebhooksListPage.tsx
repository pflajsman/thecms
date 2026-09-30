import { useTranslation } from 'react-i18next'
import { i18n } from '@/i18n'
import { Link } from 'react-router-dom'
import { Plus, Webhook as WebhookIcon } from 'lucide-react'
import { formatRelative } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Webhook } from '../webhooks-api'
import { useWebhooks } from '../webhooks-queries'

function lastDelivery(h: Webhook): string {
  if (h.lastDeliveryStatus === 'FAILED') return i18n.t('webhooks:list.lastFailed')
  if (h.lastDeliveryAt) return i18n.t('webhooks:list.delivered', { when: formatRelative(h.lastDeliveryAt) })
  return i18n.t('webhooks:list.noDeliveries')
}

export function WebhooksListPage() {
  const { t } = useTranslation('webhooks')
  const hooks = useWebhooks()
  const action = (
    <Button asChild>
      <Link to="/webhooks/new">
        <Plus aria-hidden />
        {t('list.new')}
      </Link>
    </Button>
  )
  let body: React.ReactNode
  if (hooks.isPending) body = <Skeleton className="h-32 w-full" />
  else if (hooks.isError) body = <ErrorState message={t('list.loadError')} onRetry={() => void hooks.refetch()} />
  else if (hooks.data.length === 0)
    body = (
      <EmptyState
        icon={WebhookIcon}
        title={t('list.emptyTitle')}
        description={t('list.emptyText')}
        action={action}
      />
    )
  else
    body = (
      <ul className="flex flex-col divide-y rounded-xl border bg-card">
        {hooks.data.map((h) => (
          <li key={h.id}>
            <Link to={`/webhooks/${h.id}`} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-accent sm:flex-row sm:items-center sm:gap-4">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{h.name}</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">{h.url}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {t('list.eventCount', { count: h.events.length })} · {h.isActive ? t('list.active') : t('list.paused')}
              </span>
              <span className="text-sm text-muted-foreground">{lastDelivery(h)}</span>
            </Link>
          </li>
        ))}
      </ul>
    )
  return (
    <>
      <PageHeader title={t('list.title')} description={t('list.description')} actions={action} />
      {body}
    </>
  )
}
