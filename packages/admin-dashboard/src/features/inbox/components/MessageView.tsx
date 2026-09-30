import { useTranslation } from 'react-i18next'
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
  /** Called after a status change so the page can update a message held outside the current view. */
  onStatusChange?: (status: InboxItem['status']) => void
}

export function MessageView({ item, backTo, onDeleted, onStatusChange }: MessageViewProps) {
  const { t } = useTranslation('inbox')
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
    <article aria-label={t('messageFrom', { sender })} className="rounded-xl border bg-card p-4 md:p-6">
      {backTo && (
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to={backTo}>
            <ArrowLeft aria-hidden />
            {t('back')}
          </Link>
        </Button>
      )}
      <header className="mb-4">
        <h2 className="font-serif text-2xl font-semibold">{sender}</h2>
        <p className="text-sm text-muted-foreground">
          {item.form?.name ?? t('deletedForm')} · {formatAbsolute(item.createdAt)}
        </p>
      </header>
      {!item.emailSent && item.emailError && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-status-draft-bg px-3 py-2 text-sm text-status-draft-fg">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('emailFailed', { error: item.emailError })}
        </p>
      )}
      <dl className="flex flex-col gap-3">
        {displayFields(item).map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="whitespace-pre-wrap break-words">{row.value || <span className="text-muted-foreground">{t('empty')}</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        {reply && (
          <Button asChild>
            <a href={`mailto:${reply}?subject=${encodeURIComponent(`Re: ${item.form?.name ?? t('yourMessage')}`)}`}>{t('reply')}</a>
          </Button>
        )}
        {item.status === 'UNREAD' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'READ').then(() => onStatusChange?.('READ')), t('toast.markedRead'))}>{t('markRead')}</Button>
        ) : item.status === 'READ' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'UNREAD').then(() => onStatusChange?.('UNREAD')), t('toast.markedUnread'))}>{t('markUnread')}</Button>
        ) : null}
        {item.status === 'ARCHIVED' ? (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'READ').then(() => onStatusChange?.('READ')), t('toast.restored'))}>{t('restore')}</Button>
        ) : (
          <Button variant="outline" onClick={() => void run(() => writes.setStatus(item, 'ARCHIVED').then(() => onStatusChange?.('ARCHIVED')), t('toast.archived'))}>{t('archive')}</Button>
        )}
        <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>{t('actions.delete', { ns: 'common' })}</Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('deleteTitle')}
        description={t('deleteText')}
        confirmLabel={t('actions.delete', { ns: 'common' })}
        destructive
        onConfirm={() => {
          setConfirmDelete(false)
          void run(async () => {
            await writes.remove(item)
            onDeleted()
          }, t('toast.deleted'))
        }}
      />
    </article>
  )
}
