import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, SearchX } from 'lucide-react'
import type { EntryListItem } from '@/types'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Pager } from '@/components/common/Pager'
import { DataList, type DataColumn } from '@/components/common/DataList'
import { StatusPill } from '@/components/common/StatusPill'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useStats } from '@/lib/queries/stats'
import { useHotkey } from '@/lib/hooks/useHotkey'
import { formatAbsolute, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { UNTITLED } from '@/lib/entry-schema'
import { useContentTypes, useEntryList } from '../queries'
import { PAGE_SIZE, toEntryQuery, useContentListParams } from '../list-params'
import { ContentFilters } from '../components/ContentFilters'
import { NewEntryButton } from '../components/NewEntryButton'
import { EntryRowMenu } from '../components/EntryRowMenu'
import { TypeChooser } from '../components/TypeChooser'

export function ContentListPage() {
  const navigate = useNavigate()
  const [params, update] = useContentListParams()
  const typesQuery = useContentTypes()
  const stats = useStats()
  const list = useEntryList(toEntryQuery(params))
  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data])
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types])
  const filtersActive = !!(params.type || params.status || params.q)

  useHotkey('n', () => navigate(params.type ? `/content/new?type=${params.type}` : '/content/new'))

  // A page past the end (old link, deleted entries) jumps to the last page instead of looking empty.
  const pagination = list.data?.pagination
  const rows = list.data?.data
  useEffect(() => {
    if (rows && rows.length === 0 && pagination && pagination.total > 0 && params.page > pagination.totalPages) {
      update({ page: pagination.totalPages })
    }
  }, [rows, pagination, params.page, update])

  const columns: DataColumn<EntryListItem>[] = [
    { id: 'title', header: 'Title', cell: (e) => <TitleLink entry={e} /> },
    { id: 'type', header: 'Model', cell: (e) => <TypeLabel entry={e} />, className: 'w-40' },
    { id: 'edited', header: 'Edited', cell: (e) => <Edited date={e.updatedAt} />, className: 'w-32 whitespace-nowrap' },
    { id: 'status', header: 'Status', cell: (e) => <StatusPill status={e.status} />, className: 'w-28' },
    { id: 'actions', header: '', cell: (e) => <EntryRowMenu entry={e} type={e.contentType ? typeById.get(e.contentType.id) : undefined} />, className: 'w-12 text-right' },
  ]

  let body: React.ReactNode
  if (typesQuery.isSuccess && types.length === 0) {
    body = <TypeChooser types={[]} />
  } else if (list.isPending || (rows?.length === 0 && (list.isPlaceholderData || (pagination && pagination.total > 0 && params.page > pagination.totalPages)))) {
    body = <ListSkeleton />
  } else if (list.isError) {
    body = <ErrorState message="Could not load content." onRetry={() => void list.refetch()} />
  } else if (list.data.data.length === 0 && filtersActive) {
    body = (
      <EmptyState
        icon={SearchX}
        title="No entries match these filters"
        action={<Button variant="outline" onClick={() => update({ type: undefined, status: undefined, q: undefined })}>Clear filters</Button>}
      />
    )
  } else if (list.data.data.length === 0) {
    body = (
      <EmptyState
        icon={FileText}
        title="No entries yet"
        description="Create your first entry to see it here."
        action={<Button asChild><Link to="/content/new">New entry</Link></Button>}
      />
    )
  } else {
    body = (
      <div className={cn(list.isPlaceholderData && 'opacity-60 transition-opacity')}>
        <DataList
          caption="Entries"
          rows={list.data.data}
          columns={columns}
          rowKey={(e) => e.id}
          mobileRow={(e) => (
            <div className="flex items-start gap-3">
              <TypeBadge entry={e} />
              <div className="min-w-0 flex-1">
                <TitleLink entry={e} />
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.contentType?.name ?? 'Deleted model'} · <Edited date={e.updatedAt} />
                </p>
              </div>
              <StatusPill status={e.status} />
              <EntryRowMenu entry={e} type={e.contentType ? typeById.get(e.contentType.id) : undefined} />
            </div>
          )}
        />
        <Pager page={params.page} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={(p) => update({ page: p })} />
      </div>
    )
  }

  return (
    <>
      <PageHeader title="Content" description="Everything you publish, across all content models." actions={<NewEntryButton types={types} />} />
      {types.length > 0 && <ContentFilters types={types} counts={stats.data?.entries.byType} params={params} update={update} />}
      {body}
    </>
  )
}

function TitleLink({ entry }: { entry: EntryListItem }) {
  const untitled = entry.title === UNTITLED
  return (
    <Link
      to={`/content/${entry.id}`}
      className={cn('font-serif text-base font-semibold hover:underline', untitled && 'italic text-muted-foreground')}
    >
      {entry.title}
    </Link>
  )
}

function TypeLabel({ entry }: { entry: EntryListItem }) {
  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <TypeBadge entry={entry} />
      {entry.contentType?.name ?? 'Deleted model'}
    </span>
  )
}

function TypeBadge({ entry }: { entry: EntryListItem }) {
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary font-serif text-sm font-semibold text-secondary-foreground">
      {(entry.contentType?.name ?? '?').charAt(0).toUpperCase()}
    </span>
  )
}

function Edited({ date }: { date: string }) {
  return <time dateTime={date} title={formatAbsolute(date)}>{formatRelative(date)}</time>
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading entries" className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}

