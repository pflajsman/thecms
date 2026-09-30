import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'

export function ShellSkeleton() {
  const { t } = useTranslation('shell')
  return (
    <div role="status" aria-busy="true" aria-label={t('loading')} className="flex min-h-dvh bg-background">
      <div className="hidden w-60 flex-col gap-3 bg-sidebar p-4 md:flex">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-full rounded-full" />
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
      <div className="flex-1 space-y-4 p-6 md:p-8">
        <Skeleton className="h-9 w-48" />
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    </div>
  )
}
