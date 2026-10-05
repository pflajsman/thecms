import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { AppModule } from '@/modules/types'
import { groupModules, isModuleActive } from '@/modules/nav'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/common/Logo'
import { useCommandPalette } from './command-palette-context'
import { UserMenu } from './UserMenu'
import { ProjectSwitcher } from '@/features/projects/components/ProjectSwitcher'

interface SidebarProps {
  modules: AppModule[]
}

export function Sidebar({ modules }: SidebarProps) {
  const { pathname } = useLocation()
  const { setOpen } = useCommandPalette()
  const { workspace, commerce, setup } = groupModules(modules)
  const { t } = useTranslation('shell')

  return (
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col bg-sidebar px-2 py-4 text-sidebar-foreground md:flex lg:w-60 lg:px-3">
      <Link to="/" className="mb-4 flex items-center gap-2 px-2 text-foreground">
        <Logo />
        <span className="hidden font-serif text-lg font-semibold lg:inline">TheCMS</span>
      </Link>
      <ProjectSwitcher variant="sidebar" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('search.open')}
        className="mb-3 flex items-center justify-center gap-2 rounded-full border border-sidebar-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent lg:justify-start"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left lg:inline">{t('search.short')}</span>
        <kbd className="hidden text-xs lg:inline">⌘K</kbd>
      </button>
      <nav aria-label={t('sidebar.mainNav')} className="flex flex-1 flex-col gap-5 overflow-y-auto">
        <NavGroup label={t('groups.workspace')} modules={workspace} pathname={pathname} />
        <NavGroup label={t('groups.commerce')} modules={commerce} pathname={pathname} />
        <NavGroup label={t('groups.setup')} modules={setup} pathname={pathname} />
      </nav>
      <UserMenu variant="sidebar" />
    </aside>
  )
}

function NavGroup({ label, modules, pathname }: { label: string; modules: AppModule[]; pathname: string }) {
  if (modules.length === 0) return null
  return (
    <div>
      <p className="mb-1 hidden px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:block">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {modules.map((m) => (
          <li key={m.id}>
            <NavItem module={m} active={isModuleActive(m, pathname)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function NavItem({ module, active }: { module: AppModule; active: boolean }) {
  const { t } = useTranslation('shell')
  const Icon = module.icon
  const label = t(module.labelKey)
  return (
    <Link
      to={module.path}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={cn(
        'relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
        active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground',
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="hidden flex-1 lg:inline">{label}</span>
      {module.useBadge && <NavBadge useCount={module.useBadge} />}
    </Link>
  )
}

function NavBadge({ useCount }: { useCount: () => number | undefined }) {
  const count = useCount()
  if (!count) return null
  return (
    <span className="absolute top-0.5 right-0.5 rounded-full bg-status-unread-fg px-1 text-[10px] font-semibold leading-4 text-background lg:static lg:px-1.5">
      {count > 99 ? '99+' : count}
    </span>
  )
}
