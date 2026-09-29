import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <Icon aria-hidden className="mb-3 size-10 text-muted-foreground" />
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
