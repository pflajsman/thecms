import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { createActions, modules } from '@/modules/registry'
import { CommandPaletteProvider } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileTabs } from './MobileTabs'
import { SignInScreen } from './SignInScreen'
import { ShellSkeleton } from './ShellSkeleton'

export function AppShell() {
  const { isLoading, isAuthenticated } = useAuth()
  const { t } = useTranslation('shell')

  if (isLoading) return <ShellSkeleton />
  if (!isAuthenticated) return <SignInScreen />

  return (
    <CommandPaletteProvider modules={modules} actions={createActions}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {t('skipToContent')}
      </a>
      <div className="flex min-h-dvh bg-background text-foreground">
        <Sidebar modules={modules} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar modules={modules} />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10">
            <Outlet />
          </main>
        </div>
        <MobileTabs modules={modules} actions={createActions} />
      </div>
    </CommandPaletteProvider>
  )
}
