import { useTranslation } from 'react-i18next'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { isAxiosError } from 'axios'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useContentType, useContentTypes, useEntry } from '../queries'
import { entryTypeId } from '../content-api'
import { TypeChooser } from '../components/TypeChooser'
import { EntryEditor } from '../editor/EntryEditor'

export function EntryEditorPage() {
  const { id = 'new' } = useParams()
  const { t } = useTranslation('editor')
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const isNew = id === 'new'
  const entryQuery = useEntry(isNew ? undefined : id)
  const typeId = isNew ? searchParams.get('type') ?? undefined : entryQuery.data ? entryTypeId(entryQuery.data) : undefined
  const typeQuery = useContentType(typeId)
  const typesQuery = useContentTypes()

  if (isNew && !typeId) {
    return (
      <>
        <PageHeader title={t('page.newTitle')} description={t('page.newText')} />
        {typesQuery.data ? <TypeChooser types={typesQuery.data} /> : <Skeleton className="h-24 w-full" />}
      </>
    )
  }

  const notFound = (!isNew && isAxiosError(entryQuery.error) && entryQuery.error.response?.status === 404) ||
    (isAxiosError(typeQuery.error) && typeQuery.error.response?.status === 404)
  if (notFound) {
    return <EmptyState icon={FileQuestion} title={t('page.notFoundTitle')} description={t('page.notFoundText')} />
  }
  if (entryQuery.isError || typeQuery.isError) {
    return <ErrorState message={t('page.loadError')} onRetry={() => { void entryQuery.refetch(); void typeQuery.refetch() }} />
  }
  if (!typeQuery.data || (!isNew && !entryQuery.data)) {
    return (
      <div role="status" aria-busy="true" aria-label={t('page.loading')} className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // One editor per entry. The create redirect (/content/new -> /content/:id) carries
  // editorKey 'new' so the editor stays mounted and in-progress edits survive.
  const editorKey = isNew ? 'new' : (location.state as { editorKey?: string } | null)?.editorKey ?? id
  return <EntryEditor key={`${typeQuery.data.id}:${editorKey}`} contentType={typeQuery.data} entry={isNew ? undefined : entryQuery.data} />
}
