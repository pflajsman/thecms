import { useParams, useSearchParams } from 'react-router-dom'
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
  const [searchParams] = useSearchParams()
  const isNew = id === 'new'
  const entryQuery = useEntry(isNew ? undefined : id)
  const typeId = isNew ? searchParams.get('type') ?? undefined : entryQuery.data ? entryTypeId(entryQuery.data) : undefined
  const typeQuery = useContentType(typeId)
  const typesQuery = useContentTypes()

  if (isNew && !typeId) {
    return (
      <>
        <PageHeader title="New entry" description="Choose what you want to create." />
        {typesQuery.data ? <TypeChooser types={typesQuery.data} /> : <Skeleton className="h-24 w-full" />}
      </>
    )
  }

  const notFound = (!isNew && isAxiosError(entryQuery.error) && entryQuery.error.response?.status === 404) ||
    (isAxiosError(typeQuery.error) && typeQuery.error.response?.status === 404)
  if (notFound) {
    return <EmptyState icon={FileQuestion} title="This entry does not exist" description="It may have been deleted." />
  }
  if (entryQuery.isError || typeQuery.isError) {
    return <ErrorState message="Could not load this entry." onRetry={() => { void entryQuery.refetch(); void typeQuery.refetch() }} />
  }
  if (!typeQuery.data || (!isNew && !entryQuery.data)) {
    return (
      <div aria-busy="true" aria-label="Loading entry" className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  // Keyed by type only: after the first save the URL changes from /content/new to /content/:id
  // and the editor must stay mounted so in-progress edits survive.
  return <EntryEditor key={typeQuery.data.id} contentType={typeQuery.data} entry={isNew ? undefined : entryQuery.data} />
}
