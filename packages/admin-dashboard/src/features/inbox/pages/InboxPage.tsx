import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Inbox, MailCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/format'
import { useIsDesktop } from '@/lib/hooks/useMediaQuery'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForms } from '@/features/forms/forms-api'
import type { InboxItem, InboxView } from '../inbox-api'
import { useInbox, useSubmissionWrites } from '../inbox-queries'
import { preview, senderName, viewStatus } from '../inbox-utils'
import { MessageView } from '../components/MessageView'

const VIEWS: { id: InboxView; label: string }[] = [
  { id: 'unread', label: 'Unread' },
  { id: 'all', label: 'All' },
  { id: 'archived', label: 'Archived' },
]

export function InboxPage() {
  const { submissionId } = useParams()
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const view = (VIEWS.find((v) => v.id === sp.get('view'))?.id ?? 'unread') as InboxView
  const formId = sp.get('form') ?? undefined
  const forms = useForms()
  const inbox = useInbox({ status: viewStatus(view), formId, limit: 30 })
  const writes = useSubmissionWrites()
  const items = inbox.data?.data ?? []
  // Keep the open message on screen when it leaves the current view (for example once it is marked read).
  const found = items.find((i) => i.id === submissionId)
  // `source` is the list copy last adopted; only a newer copy from the server replaces the held one.
  const [held, setHeld] = useState<{ source?: InboxItem; item?: InboxItem }>({})
  if (found && found !== held.source) setHeld({ source: found, item: found })
  const selected = found && found !== held.source ? found : held.item && held.item.id === submissionId ? held.item : undefined
  const query = sp.toString() ? `?${sp.toString()}` : ''

  // Opening an unread message marks it read, once per message.
  const marked = useRef(new Set<string>())
  useEffect(() => {
    if (selected && selected.status === 'UNREAD' && !marked.current.has(selected.id)) {
      marked.current.add(selected.id)
      const id = selected.id
      void writes.setStatus(selected, 'READ').then(() =>
        setHeld((h) => (h.item && h.item.id === id ? { ...h, item: { ...h.item, status: 'READ' } } : h)),
      )
    }
  }, [selected, writes])

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(sp)
    if (value) next.set(key, value)
    else next.delete(key)
    setSp(next, { replace: true })
  }

  const showList = desktop || !submissionId
  const showMessage = desktop || !!submissionId

  const list = inbox.isPending ? (
    <Skeleton className="h-40 w-full" />
  ) : inbox.isError ? (
    <ErrorState message="Could not load messages." onRetry={() => void inbox.refetch()} />
  ) : items.length === 0 ? (
    view === 'unread' ? (
      <EmptyState icon={MailCheck} title="You are all caught up" description="New messages from your forms appear here." />
    ) : (
      <EmptyState icon={Inbox} title={view === 'archived' ? 'Nothing archived' : 'No messages yet'} action={view === 'all' ? <Link to="/forms" className="text-sm text-primary hover:underline">Set up a form</Link> : undefined} />
    )
  ) : (
    <ul aria-label="Messages" className="flex flex-col divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={`/inbox/${item.id}${query}`}
            aria-current={item.id === submissionId ? 'true' : undefined}
            className={cn('block px-4 py-3 hover:bg-accent', item.id === submissionId && 'bg-accent')}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className={cn('truncate', item.status === 'UNREAD' && 'font-semibold')}>{senderName(item)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.createdAt)}</span>
            </span>
            <span className="block truncate text-sm text-muted-foreground">{preview(item)}</span>
            <span className="block text-xs text-muted-foreground">{item.form?.name ?? 'Deleted form'}</span>
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <PageHeader title="Inbox" description="Messages sent through your forms." />
      {showList && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="View" className="flex gap-1.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === view}
                onClick={() => setParam('view', v.id === 'unread' ? undefined : v.id)}
                className={cn('rounded-full border px-3 py-1 text-sm', v.id === view ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent')}
              >
                {v.label}
              </button>
            ))}
          </div>
          <Select value={formId ?? 'all'} onValueChange={(v) => setParam('form', v === 'all' ? undefined : v)}>
            <SelectTrigger aria-label="Form" className="w-48 rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All forms</SelectItem>
              {(forms.data ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className={cn(desktop && 'grid grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4')}>
        {showList && <div>{list}</div>}
        {showMessage && (
          <div>
            {selected ? (
              <MessageView item={selected} backTo={desktop ? undefined : `/inbox${query}`} onDeleted={() => navigate(`/inbox${query}`, { replace: true })} />
            ) : desktop && items.length > 0 ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Select a message to read it.</p>
            ) : submissionId && !inbox.isPending ? (
              <EmptyState icon={Inbox} title="Message not found" description="It may be in another view or deleted." action={<Link to="/inbox?view=all" className="text-sm text-primary hover:underline">Show all messages</Link>} />
            ) : null}
          </div>
        )}
      </div>
    </>
  )
}
