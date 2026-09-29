import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { formatAbsolute } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import type { InboxItem } from '../inbox-api'
import { useSubmissionWrites } from '../inbox-queries'
import { displayFields, replyAddress, senderName } from '../inbox-utils'

interface MessageViewProps {
  item: InboxItem
  backTo?: string
  onDeleted: () => void
}

export function MessageView({ item, backTo, onDeleted }: MessageViewProps) {
  const writes = useSubmissionWrites()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sender = senderName(item)
  const reply = replyAddress(item)

  const run = async (fn: () => Promise<void>, message: string) => {
    try {
      await fn()
      toast.success(message)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <article aria-label={`Message from ${sender}`} className="rounded-xl border bg-card p-4 md:p-6">
      {backTo && (
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to={backTo}>
            <ArrowLeft aria-hidden />
            Back to messages
          </Link>
        </Button>
      )}
      <header className="mb-4">
        <h2 className="font-serif text-2xl font-semibold">{sender}</h2>
        <p className="text-sm text-muted-foreground">
          {item.form?.name ?? 'Deleted form'} · {formatAbsolute(item.createdAt)}
        </p>
      </header>
      {!item.emailSent && item.emailError && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-status-draft-bg px-3 py-2 text-sm text-status-draft-fg">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          Notification email failed: {item.emailError}
        </p>
      )}
      <dl className="flex flex-col gap-3">
        {displayFields(item).map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="whitespace-pre-wrap break-words">{row.value || <span className="text-muted-foreground">Empty</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        {reply && (
          <Button asChild>
            <a href={`mailto:${reply}?subject=${encodeURIComponent(`Re: ${item.form?.name ?? 'your message'}`)}`}>Reply</a>
          </Button>
        )}
        {item.status === 'UNREAD' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'READ'), 'Marked as read')}>Mark read</Button>
        ) : item.status === 'READ' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'UNREAD'), 'Marked as unread')}>Mark unread</Button>
        ) : null}
        {item.status === 'ARCHIVED' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'READ'), 'Moved back to inbox')}>Restore</Button>
        ) : (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'ARCHIVED'), 'Archived')}>Archive</Button>
        )}
        <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>Delete</Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this message?"
        description="This permanently removes the message."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDelete(false)
          void run(async () => {
            await writes.remove(item)
            onDeleted()
          }, 'Message deleted')
        }}
      />
    </article>
  )
}
