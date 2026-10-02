import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { KeyRound, LogOut, Monitor, Moon, Sparkles, Sun } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAiStatus } from '@/features/ai/ai-queries'
import { useTheme } from '@/app/theme/useTheme'
import type { ThemePreference } from '@/app/theme/theme-utils'
import type { AppModule } from '@/modules/types'
import { getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, isLanguage } from '@/i18n/language'
import { useLanguage } from '@/i18n/useLanguage'
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

const THEMES: { value: ThemePreference; labelKey: 'userMenu.themeLight' | 'userMenu.themeDark' | 'userMenu.themeSystem'; icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'userMenu.themeLight', icon: Sun },
  { value: 'dark', labelKey: 'userMenu.themeDark', icon: Moon },
  { value: 'system', labelKey: 'userMenu.themeSystem', icon: Monitor },
]

export function UserMenu({ variant, setupModules }: UserMenuProps) {
  const { user, logout } = useAuth()
  const { preference, setPreference } = useTheme()
  const { t } = useTranslation('shell')
  const { language, setLanguage } = useLanguage()
  const aiStatus = useAiStatus()
  const name = user?.name || user?.email || t('userMenu.account')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'sidebar' && 'w-full rounded-lg border-t border-sidebar-border px-2 pt-3',
        )}
        aria-label={t('userMenu.accountMenu')}
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
            <DropdownMenuLabel className="text-xs text-muted-foreground">{t('userMenu.setup')}</DropdownMenuLabel>
            {setupModules.map((m) => (
              <DropdownMenuItem key={m.id} asChild>
                <Link to={m.path}>
                  <m.icon aria-hidden />
                  {t(m.labelKey)}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        {aiStatus.data && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/account/ai">
                <Sparkles aria-hidden />
                {t('userMenu.aiAssistant')}
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account/tokens">
            <KeyRound aria-hidden />
            {t('userMenu.accessTokens')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t('userMenu.theme')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          {THEMES.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <item.icon aria-hidden className="size-4" />
              {t(item.labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t('userMenu.language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={language} onValueChange={(v) => isLanguage(v) && setLanguage(v)}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {LANGUAGE_NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOut aria-hidden />
          {t('userMenu.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
