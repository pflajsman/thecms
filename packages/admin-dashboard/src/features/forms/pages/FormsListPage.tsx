import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'
import { useForms } from '../forms-api'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function FormsListPage() {
  const { t } = useTranslation('forms')
  const forms = useForms()
  const action = (
    <Button asChild>
      <Link to="/forms/new"><Plus aria-hidden />{t('list.new')}</Link>
    </Button>
  )
  let body: React.ReactNode
  if (forms.isPending) body = <Skeleton className="h-32 w-full" />
  else if (forms.isError) body = <ErrorState message={t('list.loadError')} onRetry={() => void forms.refetch()} />
  else if (forms.data.length === 0) body = <EmptyState icon={ClipboardList} title={t('list.emptyTitle')} description={t('list.emptyText')} action={action} />
  else
    body = (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {forms.data.map((f) => (
          <li key={f.id} className="rounded-xl border bg-card p-4">
            <Link to={`/forms/${f.id}`} className="block font-serif text-lg font-semibold hover:underline">{f.name}</Link>
            <span className="block font-mono text-xs text-muted-foreground">{f.slug}</span>
            <p className="mt-2 text-sm text-muted-foreground">
              {f.isActive ? t('list.accepting') : t('list.paused')} · {t('count.submissions', { count: f.submissionCount })}
            </p>
            <Link to={`/inbox?form=${f.id}&view=all`} className="mt-2 inline-block text-sm text-primary hover:underline">{t('list.viewMessages')}</Link>
          </li>
        ))}
      </ul>
    )
  return (
    <>
      <PageHeader title={t('list.title')} description={t('list.description')} actions={action} />
      {body}
    </>
  )
}
