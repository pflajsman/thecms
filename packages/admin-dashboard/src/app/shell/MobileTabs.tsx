import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import type { AppModule, CreateAction } from '@/modules/types'
import { isModuleActive, mobileTabModules } from '@/modules/nav'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface MobileTabsProps {
  modules: AppModule[]
  actions: CreateAction[]
}

export function MobileTabs({ modules, actions }: MobileTabsProps) {
  const { pathname } = useLocation()
  const tabs = mobileTabModules(modules)
  const middle = Math.ceil(tabs.length / 2)
  const { t } = useTranslation('shell')

  return (
    <nav
      aria-label={t('mobile.primary')}
      className="fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.slice(0, middle).map((m) => (
        <Tab key={m.id} module={m} active={isModuleActive(m, pathname)} />
      ))}
      <CreateMenu actions={actions} />
      {tabs.slice(middle).map((m) => (
        <Tab key={m.id} module={m} active={isModuleActive(m, pathname)} />
      ))}
    </nav>
  )
}

function Tab({ module, active }: { module: AppModule; active: boolean }) {
  const { t } = useTranslation('shell')
  const Icon = module.icon
  return (
    <Link
      to={module.path}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]',
        active ? 'font-semibold text-foreground' : 'text-sidebar-foreground',
      )}
    >
      <Icon aria-hidden className="size-5" />
      {t(module.labelKey)}
      {module.useBadge && <TabDot useCount={module.useBadge} />}
    </Link>
  )
}

function TabDot({ useCount }: { useCount: () => number | undefined }) {
  const count = useCount()
  if (!count) return null
  return (
    <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-status-unread-fg px-1 text-[10px] leading-4 text-background">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function CreateMenu({ actions }: { actions: CreateAction[] }) {
  const navigate = useNavigate()
  const { t } = useTranslation('shell')
  return (
    <div className="flex flex-1 justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('mobile.create')}
          className="-mt-5 mb-2 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus aria-hidden className="size-6" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="w-48">
          {actions.map((a) => (
            <DropdownMenuItem key={a.id} onSelect={() => navigate(a.to)}>
              <a.icon aria-hidden />
              {t(a.labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
