import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, PanelRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EditorAction, EditorActionSet } from './editor-actions'

interface EditorTopBarProps {
  typeName: string
  saveLabel: string
  saveTone: 'muted' | 'error'
  onRetry?: () => void
  actions: EditorActionSet
  busy: boolean
  onAction: (action: EditorAction) => void
  onOpenDetails: () => void
  /** Language switcher, shown when the installation has more than one language. */
  languageMenu?: ReactNode
}

export function EditorTopBar({ typeName, saveLabel, saveTone, onRetry, actions, busy, onAction, onOpenDetails, languageMenu }: EditorTopBarProps) {
  const { t } = useTranslation('editor')
  const safeMenu = actions.menu.filter((m) => !m.destructive)
  const dangerMenu = actions.menu.filter((m) => m.destructive)
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:top-0 md:-mx-8 md:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/content">
          <ArrowLeft aria-hidden />
          {t('topBar.back')}
        </Link>
      </Button>
      <span className="hidden text-sm text-muted-foreground sm:inline">/ {typeName}</span>
      {languageMenu}
      <span className="flex-1" />
      <span role="status" aria-live="polite" className={saveTone === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
        {saveLabel}
        {onRetry && (
          <button type="button" onClick={onRetry} className="ml-2 underline">
            {t('save.retry')}
          </button>
        )}
      </span>
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('topBar.details')} onClick={onOpenDetails}>
        <PanelRight aria-hidden />
      </Button>
      {actions.secondary && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction(actions.secondary!.action)}>
          {t(actions.secondary.labelKey)}
        </Button>
      )}
      <Button size="sm" disabled={busy || actions.primary.disabled} onClick={() => onAction(actions.primary.action)}>
        {t(actions.primary.labelKey)}
      </Button>
      {actions.menu.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('topBar.moreActions')}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {safeMenu.map((m) => (
              <DropdownMenuItem key={m.action} onSelect={() => onAction(m.action)}>{t(m.labelKey)}</DropdownMenuItem>
            ))}
            {dangerMenu.length > 0 && <DropdownMenuSeparator />}
            {dangerMenu.map((m) => (
              <DropdownMenuItem key={m.action} className="text-destructive focus:text-destructive" onSelect={() => onAction(m.action)}>
                {t(m.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
