import { Webhook } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'

export function WebhooksPlaceholder() {
  return (
    <>
      <PageHeader title="Webhooks" description="Notify other services when content changes." />
      <EmptyState
        icon={Webhook}
        title="Webhook management is coming"
        description="Webhooks already work through the API. A screen to manage them arrives in a later update."
      />
    </>
  )
}
