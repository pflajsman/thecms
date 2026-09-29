import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { AppModule } from '@/modules/types'
import { findActiveModule, groupModules } from '@/modules/nav'
import { Button } from '@/components/ui/button'
import { useCommandPalette } from './command-palette-context'
import { UserMenu } from './UserMenu'

export function TopBar({ modules }: { modules: AppModule[] }) {
  const { pathname } = useLocation()
  const { setOpen } = useCommandPalette()
  const active = findActiveModule(modules, pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:hidden">
      <span className="flex-1 truncate font-serif text-lg font-semibold">{active?.label ?? 'TheCMS'}</span>
      <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setOpen(true)}>
        <Search aria-hidden />
      </Button>
      <UserMenu variant="compact" setupModules={groupModules(modules).setup} />
    </header>
  )
}
