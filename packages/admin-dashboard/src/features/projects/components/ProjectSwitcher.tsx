import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check, ChevronsUpDown, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/format'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useOptionalProject } from '../ProjectContext'

/** The current project; a menu to switch when there is more than one, or for a superadmin. */
export function ProjectSwitcher({ variant }: { variant: 'sidebar' | 'compact' }) {
  const context = useOptionalProject()
  return context ? <Switcher variant={variant} {...context} /> : null
}

function Switcher({ variant, me, projects, project, switchProject }: { variant: 'sidebar' | 'compact' } & NonNullable<ReturnType<typeof useOptionalProject>>) {
  const { t } = useTranslation('projects')
  const canSwitch = projects.length > 1 || me.isSuperadmin
  const initials = getInitials(project.name)

  const label = (
    <>
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">{initials}</span>
      <span className={cn('min-w-0 flex-1 truncate text-left text-sm font-medium', variant === 'sidebar' && 'hidden lg:inline')}>
        <span className="sr-only">{t('switcher.label')}: </span>
        {project.name}
      </span>
    </>
  )
  const boxClass = cn('flex items-center gap-2 rounded-lg px-2 py-1.5', variant === 'sidebar' && 'mb-3 w-full', variant === 'compact' && 'max-w-48')

  if (!canSwitch) return <div className={boxClass}>{label}</div>

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(boxClass, 'outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring')} aria-label={t('switcher.choose')}>
        {label}
        <ChevronsUpDown aria-hidden className={cn('size-4 shrink-0 text-muted-foreground', variant === 'sidebar' && 'hidden lg:block')} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t('switcher.choose')}</DropdownMenuLabel>
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => p.id !== project.id && switchProject(p.id)}>
            <Check aria-hidden className={cn('size-4', p.id !== project.id && 'invisible')} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="text-xs text-muted-foreground">{t(`roles.${p.role}`)}</span>
          </DropdownMenuItem>
        ))}
        {me.isSuperadmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin/projects">
                <FolderKanban aria-hidden />
                {t('switcher.manage')}
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
