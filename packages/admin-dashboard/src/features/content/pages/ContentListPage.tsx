import { useTranslation } from 'react-i18next'
import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, SearchX } from 'lucide-react'
import type { EntryListItem, MediaFile } from '@/types'
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
import { useMediaByIds } from '@/features/media/queries'
import { MediaThumb } from '@/features/media/components/MediaTile'
import { isImage } from '@/features/media/media-utils'
import { coverMediaId } from '../cover'
import { useLanguages } from '@/features/languages/languages-queries'

export function ContentListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation('content')
  const [params, update] = useContentListParams()
  const typesQuery = useContentTypes()
  const stats = useStats()
  const languages = useLanguages().data
  const multilingual = (languages?.length ?? 0) > 1
  const list = useEntryList(toEntryQuery(params))
  const types = useMemo(() => typesQuery.data ?? [], [typesQuery.data])
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types])
  const coverIds = useMemo(
    () => (list.data?.data ?? []).map((e) => coverMediaId(e, e.contentType ? typeById.get(e.contentType.id) : undefined)).filter((id): id is string => !!id),
    [list.data, typeById],
  )
  const covers = useMediaByIds(coverIds)
  const coverFor = (e: EntryListItem) => {
    const id = coverMediaId(e, e.contentType ? typeById.get(e.contentType.id) : undefined)
    return id ? covers.byId.get(id) : undefined
  }
  const filtersActive = !!(params.type || params.status || params.q || params.lang || params.missing)

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
    { id: 'title', header: t('columns.title'), cell: (e) => <span className="flex items-center gap-3"><TypeBadge entry={e} cover={coverFor(e)} /><span><TitleLink entry={e} />{multilingual && <LanguageBadges entry={e} />}</span></span> },
    { id: 'type', header: t('columns.model'), cell: (e) => <TypeLabel entry={e} />, className: 'w-40' },
    { id: 'edited', header: t('columns.edited'), cell: (e) => <Edited date={e.updatedAt} />, className: 'w-32 whitespace-nowrap' },
    { id: 'status', header: t('columns.status'), cell: (e) => <StatusPill status={e.status} />, className: 'w-28' },
    { id: 'actions', header: t('columns.actions'), hideHeader: true, cell: (e) => <EntryRowMenu entry={e} type={e.contentType ? typeById.get(e.contentType.id) : undefined} />, className: 'w-12 text-right' },
  ]

  let body: React.ReactNode
  if (typesQuery.isSuccess && types.length === 0) {
    body = <TypeChooser types={[]} />
  } else if (list.isPending || (rows?.length === 0 && (list.isPlaceholderData || (pagination && pagination.total > 0 && params.page > pagination.totalPages)))) {
    body = <ListSkeleton />
  } else if (list.isError) {
    body = <ErrorState message={t('list.loadError')} onRetry={() => void list.refetch()} />
  } else if (list.data.data.length === 0 && filtersActive) {
    body = (
      <EmptyState
        icon={SearchX}
        title={t('list.noMatch')}
        action={<Button variant="outline" onClick={() => update({ type: undefined, status: undefined, q: undefined, lang: undefined, missing: undefined })}>{t('list.clearFilters')}</Button>}
      />
    )
  } else if (list.data.data.length === 0) {
    body = (
      <EmptyState
        icon={FileText}
        title={t('list.emptyTitle')}
        description={t('list.emptyText')}
        action={<Button asChild><Link to="/content/new">{t('list.newEntry')}</Link></Button>}
      />
    )
  } else {
    body = (
      <div className={cn(list.isPlaceholderData && 'opacity-60 transition-opacity')}>
        <DataList
          caption={t('list.tableLabel')}
          rows={list.data.data}
          columns={columns}
          rowKey={(e) => e.id}
          mobileRow={(e) => (
            <div className="flex items-start gap-3">
              <TypeBadge entry={e} cover={coverFor(e)} />
              <div className="min-w-0 flex-1">
                <TitleLink entry={e} />
                {multilingual && <LanguageBadges entry={e} />}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.contentType?.name ?? t('list.deletedModel')} · <Edited date={e.updatedAt} />
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
      <PageHeader title={t('list.title')} description={t('list.description')} actions={<NewEntryButton types={types} />} />
      {types.length > 0 && <ContentFilters types={types} counts={stats.data?.entries.byType} params={params} update={update} languages={languages} />}
      {body}
    </>
  )
}

function TitleLink({ entry }: { entry: EntryListItem }) {
  const { t } = useTranslation('content')
  const untitled = entry.title === UNTITLED
  return (
    <Link
      to={`/content/${entry.id}`}
      className={cn('font-serif text-base font-semibold hover:underline', untitled && 'italic text-muted-foreground')}
    >
      {untitled ? t('list.untitled') : entry.title}
    </Link>
  )
}

function LanguageBadges({ entry }: { entry: EntryListItem }) {
  const { t } = useTranslation('content')
  if (!entry.language) return null
  const others = (entry.languages ?? []).filter((l) => l !== entry.language)
  return (
    <span className="ml-2 inline-flex items-center gap-1.5 align-middle text-xs text-muted-foreground">
      <span className="rounded border px-1 font-mono">{entry.language.toUpperCase()}</span>
      {others.length > 0 && <span>{t('list.alsoIn', { languages: others.map((l) => l.toUpperCase()).join(', ') })}</span>}
    </span>
  )
}

function TypeLabel({ entry }: { entry: EntryListItem }) {
  const { t } = useTranslation('content')
  return (
    <span className="text-muted-foreground">{entry.contentType?.name ?? t('list.deletedModel')}</span>
  )
}

function TypeBadge({ entry, cover }: { entry: EntryListItem; cover?: MediaFile }) {
  if (cover && isImage(cover)) {
    return (
      <span className="size-8 shrink-0 overflow-hidden rounded-md border">
        <MediaThumb media={cover} size="thumbnail" />
      </span>
    )
  }
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
  const { t } = useTranslation('content')
  return (
    <div role="status" aria-busy="true" aria-label={t('list.loading')} className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  )
}

