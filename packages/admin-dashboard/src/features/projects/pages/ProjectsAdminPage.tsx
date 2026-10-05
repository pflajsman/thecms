import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { FolderKanban, MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { apiErrorMessage } from '@/lib/api-error'
import type { ProjectSummary } from '../projects-api'
import { useAllProjects, useProjectWrites } from '../projects-queries'
import { useOptionalProject } from '../ProjectContext'
import { CreateProjectDialog } from '../components/CreateProjectDialog'
import { RenameProjectDialog } from '../components/RenameProjectDialog'

const ARCHIVE = { status: 'archived' } as const
const RESTORE = { status: 'active' } as const

/** Superadmin only: every project, creating one with its owner's invitation, renaming and archiving. */
export function ProjectsAdminPage() {
  const { t } = useTranslation('projects')
  const projects = useAllProjects()
  const writes = useProjectWrites()
  const current = useOptionalProject()
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<ProjectSummary | null>(null)
  const [pending, setPending] = useState(false)

  const update = async (project: ProjectSummary, body: { name?: string; status?: 'active' | 'archived' }, message: string) => {
    setPending(true)
    try {
      await writes.update(project.id, body)
      toast.success(message)
      setRenaming(null)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden />
      {t('admin.create')}
    </Button>
  )

  let body: React.ReactNode
  if (projects.isPending) body = <Skeleton className="h-40 w-full" />
  else if (projects.isError) body = <ErrorState message={t('admin.loadError')} onRetry={() => void projects.refetch()} />
  else if (projects.data.length === 0) body = <EmptyState icon={FolderKanban} title={t('admin.empty')} action={addButton} />
  else
    body = (
      <ul aria-label={t('admin.tableLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
        {projects.data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.name}</div>
              <div className="text-sm text-muted-foreground">{t('admin.memberCount', { count: p.memberCount })}</div>
            </div>
            {current?.project.id === p.id && <Badge variant="secondary">{t('admin.current')}</Badge>}
            {p.status === 'archived' && <Badge variant="outline">{t('admin.archived')}</Badge>}
            {p.status === 'active' && current && current.project.id !== p.id && (
              <Button variant="outline" size="sm" onClick={() => current.switchProject(p.id)}>{t('admin.open')}</Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('admin.actionsFor', { name: p.name })}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming(p)}>{t('admin.rename')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                {p.status === 'active' ? (
                  <DropdownMenuItem onSelect={() => void update(p, ARCHIVE, t('toast.archived', { name: p.name }))}>{t('admin.archive')}</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={() => void update(p, RESTORE, t('toast.restored', { name: p.name }))}>{t('admin.restore')}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    )

  return (
    <>
      <PageHeader title={t('admin.title')} description={t('admin.description')} actions={addButton} />
      {body}
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
      <RenameProjectDialog
        open={!!renaming}
        onOpenChange={(o) => !o && setRenaming(null)}
        name={renaming?.name ?? ''}
        pending={pending}
        onSubmit={(name) => renaming && void update(renaming, { name }, t('toast.renamed'))}
      />
    </>
  )
}
