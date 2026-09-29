import { Link } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { useForms } from '../forms-api'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function FormsListPage() {
  const forms = useForms()
  const action = (
    <Button asChild>
      <Link to="/forms/new"><Plus aria-hidden />New form</Link>
    </Button>
  )
  let body: React.ReactNode
  if (forms.isPending) body = <Skeleton className="h-32 w-full" />
  else if (forms.isError) body = <ErrorState message="Could not load forms." onRetry={() => void forms.refetch()} />
  else if (forms.data.length === 0) body = <EmptyState icon={ClipboardList} title="No forms yet" description="Create a contact or booking form your site can show." action={action} />
  else
    body = (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {forms.data.map((f) => (
          <li key={f.id} className="rounded-xl border bg-card p-4">
            <Link to={`/forms/${f.id}`} className="block font-serif text-lg font-semibold hover:underline">{f.name}</Link>
            <span className="block font-mono text-xs text-muted-foreground">{f.slug}</span>
            <p className="mt-2 text-sm text-muted-foreground">
              {f.isActive ? 'Accepting submissions' : 'Paused'} · {f.submissionCount} {f.submissionCount === 1 ? 'submission' : 'submissions'}
            </p>
            <Link to={`/inbox?form=${f.id}&view=all`} className="mt-2 inline-block text-sm text-primary hover:underline">View messages</Link>
          </li>
        ))}
      </ul>
    )
  return (
    <>
      <PageHeader title="Forms" description="Forms your sites can show. Answers arrive in the Inbox." actions={action} />
      {body}
    </>
  )
}
