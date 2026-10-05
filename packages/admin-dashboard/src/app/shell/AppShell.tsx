import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createActions, modules } from '@/modules/registry'
import { ProjectProvider, useProject } from '@/features/projects/ProjectContext'
import { NoAccessScreen } from '@/features/projects/components/NoAccessScreen'
import { ProjectsAdminPage } from '@/features/projects/pages/ProjectsAdminPage'
import { CommandPaletteProvider } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileTabs } from './MobileTabs'
import { SignInScreen } from './SignInScreen'
import { ShellSkeleton } from './ShellSkeleton'

export function AppShell() {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) return <ShellSkeleton />
  if (!isAuthenticated) return <SignInScreen />

  return (
    <ProjectProvider
      loading={<ShellSkeleton />}
      noProject={(me, retry) =>
        // A superadmin with no active project can still create one.
        me?.isSuperadmin ? (
          <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-10 md:px-8">
            <ProjectsAdminPage />
          </main>
        ) : (
          <NoAccessScreen me={me} onRetry={retry} />
        )
      }
    >
      <ProjectShell />
    </ProjectProvider>
  )
}

function ProjectShell() {
  const { t } = useTranslation('shell')
  const { can } = useProject()
  // Areas the role cannot use are left out of navigation; the server refuses them anyway.
  const visibleModules = useMemo(() => modules.filter((m) => !m.capability || can(m.capability)), [can])
  const visibleActions = useMemo(() => createActions.filter((a) => !a.capability || can(a.capability)), [can])

  return (
    <CommandPaletteProvider modules={visibleModules} actions={visibleActions}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {t('skipToContent')}
      </a>
      <div className="flex min-h-dvh bg-background text-foreground">
        <Sidebar modules={visibleModules} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar modules={visibleModules} />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
            <Outlet />
          </main>
        </div>
        <MobileTabs modules={visibleModules} actions={visibleActions} />
      </div>
    </CommandPaletteProvider>
  )
}
