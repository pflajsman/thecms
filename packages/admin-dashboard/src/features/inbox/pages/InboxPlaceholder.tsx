import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

export function InboxPlaceholder() {
  return (
    <>
      <PageHeader title="Inbox" description="Messages sent through your forms." />
      <EmptyState
        icon={Inbox}
        title="The unified inbox is coming"
        description="For now, open a form to read its submissions."
        action={<Button asChild><Link to="/forms">Go to forms</Link></Button>}
      />
    </>
  )
}
