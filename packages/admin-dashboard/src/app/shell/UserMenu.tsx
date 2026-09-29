import { Link } from 'react-router-dom'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/app/theme/useTheme'
import type { ThemePreference } from '@/app/theme/theme-utils'
import type { AppModule } from '@/modules/types'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface UserMenuProps {
  variant: 'sidebar' | 'compact'
  /** Setup modules listed in the menu (used on mobile, where the sidebar is hidden). */
  setupModules?: AppModule[]
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function UserMenu({ variant, setupModules }: UserMenuProps) {
  const { user, logout } = useAuth()
  const { preference, setPreference } = useTheme()
  const name = user?.name || user?.email || 'Account'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'sidebar' && 'w-full rounded-lg border-t border-sidebar-border px-2 pt-3',
        )}
        aria-label="Account menu"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-xs text-primary-foreground">{getInitials(user?.name)}</AvatarFallback>
        </Avatar>
        {variant === 'sidebar' && <span className="hidden min-w-0 flex-1 truncate text-sm lg:inline">{name}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-medium">{name}</div>
          {user?.email && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
        </DropdownMenuLabel>
        {setupModules && setupModules.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Setup</DropdownMenuLabel>
            {setupModules.map((m) => (
              <DropdownMenuItem key={m.id} asChild>
                <Link to={m.path}>
                  <m.icon aria-hidden />
                  {m.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          {THEMES.map((t) => (
            <DropdownMenuRadioItem key={t.value} value={t.value}>
              <t.icon aria-hidden className="size-4" />
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
