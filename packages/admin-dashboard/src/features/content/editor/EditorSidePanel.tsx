import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { ContentEntry, EntryStatus } from '@/types'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'
import { formatAbsolute } from '@/lib/format'

interface EditorSidePanelProps {
  status: EntryStatus
  isNew: boolean
  entry?: ContentEntry
  cover?: ReactNode
  canArchive: boolean
  onArchive: () => void
  onDelete: () => void
}

function statusHint(status: EntryStatus, entry?: ContentEntry): string {
  if (!entry) return 'Not saved yet'
  if (status === 'PUBLISHED' && entry.publishedAt) return `Published ${formatAbsolute(entry.publishedAt)}`
  if (status === 'ARCHIVED') return 'Hidden from sites. Restore it to edit.'
  return 'Not visible on sites'
}

export function EditorSidePanel({ status, isNew, entry, cover, canArchive, onArchive, onDelete }: EditorSidePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-3">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</h2>
        <StatusPill status={status} />
        <p className="mt-2 text-xs text-muted-foreground">{statusHint(status, entry)}</p>
      </section>
      {cover && <section className="rounded-lg border bg-card p-3">{cover}</section>}
      {entry && (
        <section className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
          <h2 className="mb-2 font-medium uppercase tracking-wide">Info</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>Created</dt>
            <dd>{formatAbsolute(entry.createdAt)}</dd>
            <dt>Edited</dt>
            <dd>{formatAbsolute(entry.updatedAt)}</dd>
            <dt>ID</dt>
            <dd className="flex items-center gap-1 font-mono">
              <span className="truncate">{entry.id}</span>
              <button
                type="button"
                aria-label="Copy entry ID"
                className="rounded p-0.5 hover:bg-accent"
                onClick={() => void navigator.clipboard?.writeText(entry.id).then(() => toast.success('ID copied'))}
              >
                <Copy aria-hidden className="size-3.5" />
              </button>
            </dd>
          </dl>
        </section>
      )}
      {!isNew && (
        <div className="flex flex-wrap gap-2">
          {canArchive && <Button variant="outline" size="sm" onClick={onArchive}>Archive</Button>}
          <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>Delete</Button>
        </div>
      )}
    </div>
  )
}
