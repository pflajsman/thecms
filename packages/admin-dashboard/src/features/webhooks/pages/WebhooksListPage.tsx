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
  if (h.lastDeliveryStatus === 'FAILED') return 'Last delivery failed'
  if (h.lastDeliveryAt) return `Delivered ${formatRelative(h.lastDeliveryAt)}`
  return 'No deliveries yet'
}

export function WebhooksListPage() {
  const hooks = useWebhooks()
  const action = (
    <Button asChild>
      <Link to="/webhooks/new">
        <Plus aria-hidden />
        New webhook
      </Link>
    </Button>
  )
  let body: React.ReactNode
  if (hooks.isPending) body = <Skeleton className="h-32 w-full" />
  else if (hooks.isError) body = <ErrorState message="Could not load webhooks." onRetry={() => void hooks.refetch()} />
  else if (hooks.data.length === 0)
    body = (
      <EmptyState
        icon={WebhookIcon}
        title="No webhooks yet"
        description="Webhooks call your endpoint when content changes, for example to rebuild your site."
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
                {h.events.length} {h.events.length === 1 ? 'event' : 'events'} · {h.isActive ? 'Active' : 'Paused'}
              </span>
              <span className="text-sm text-muted-foreground">{lastDelivery(h)}</span>
            </Link>
          </li>
        ))}
      </ul>
    )
  return (
    <>
      <PageHeader title="Webhooks" description="Notify other services when content changes." actions={action} />
      {body}
    </>
  )
}
