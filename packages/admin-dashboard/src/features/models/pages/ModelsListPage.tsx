import { Link } from 'react-router-dom'
import { Boxes, Plus } from 'lucide-react'
import { useContentTypes } from '@/features/content/queries'
import { useStats } from '@/lib/queries/stats'
import { formatRelative } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function ModelsListPage() {
  const types = useContentTypes()
  const stats = useStats()
  const action = (
    <Button asChild>
      <Link to="/models/new">
        <Plus aria-hidden />
        New model
      </Link>
    </Button>
  )

  let body: React.ReactNode
  if (types.isPending) body = <Skeleton className="h-32 w-full" />
  else if (types.isError) body = <ErrorState message="Could not load content models." onRetry={() => void types.refetch()} />
  else if (types.data.length === 0)
    body = <EmptyState icon={Boxes} title="No content models yet" description="A model defines the fields of your content. Start from a template." action={action} />
  else
    body = (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.data.map((t) => {
          const entries = stats.data?.entries.byType?.[t.id] ?? 0
          return (
            <li key={t.id}>
              <Link to={`/models/${t.id}`} className="block rounded-xl border bg-card p-4 hover:bg-accent">
                <span className="block font-serif text-lg font-semibold">{t.name}</span>
                <span className="block font-mono text-xs text-muted-foreground">{t.slug}</span>
                <span className="mt-2 block text-sm text-muted-foreground">
                  {t.fields.length} {t.fields.length === 1 ? 'field' : 'fields'} · {entries} {entries === 1 ? 'entry' : 'entries'}
                </span>
                <span className="block text-xs text-muted-foreground">Edited {formatRelative(t.updatedAt)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    )

  return (
    <>
      <PageHeader title="Content models" description="The shapes of your content: which fields each kind of entry has." actions={action} />
      {body}
    </>
  )
}
