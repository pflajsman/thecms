import { cn } from '@/lib/utils'

export type StatusValue = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'UNREAD' | 'READ'

const STATUS: Record<StatusValue, { label: string; className: string }> = {
  PUBLISHED: { label: 'Published', className: 'bg-status-published-bg text-status-published-fg' },
  DRAFT: { label: 'Draft', className: 'bg-status-draft-bg text-status-draft-fg' },
  ARCHIVED: { label: 'Archived', className: 'bg-status-archived-bg text-status-archived-fg' },
  UNREAD: { label: 'New', className: 'bg-status-unread-bg text-status-unread-fg' },
  READ: { label: 'Read', className: 'bg-status-archived-bg text-status-archived-fg' },
}

interface StatusPillProps {
  status: StatusValue
  className?: string
}

export function StatusPill({ status, className }: StatusPillProps) {
  const { label, className: tone } = STATUS[status]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tone, className)}>
      {label}
    </span>
  )
}
