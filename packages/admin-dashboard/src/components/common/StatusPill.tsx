import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type StatusValue = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'UNREAD' | 'READ'

const TONE: Record<StatusValue, string> = {
  PUBLISHED: 'bg-status-published-bg text-status-published-fg',
  DRAFT: 'bg-status-draft-bg text-status-draft-fg',
  ARCHIVED: 'bg-status-archived-bg text-status-archived-fg',
  UNREAD: 'bg-status-unread-bg text-status-unread-fg',
  READ: 'bg-status-archived-bg text-status-archived-fg',
}

interface StatusPillProps {
  status: StatusValue
  className?: string
}

export function StatusPill({ status, className }: StatusPillProps) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONE[status], className)}>
      {t(`status.${status}`)}
    </span>
  )
}
