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
}

export function EditorTopBar({ typeName, saveLabel, saveTone, onRetry, actions, busy, onAction, onOpenDetails }: EditorTopBarProps) {
  const safeMenu = actions.menu.filter((m) => !m.destructive)
  const dangerMenu = actions.menu.filter((m) => m.destructive)
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:top-0 md:-mx-8 md:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/content">
          <ArrowLeft aria-hidden />
          Content
        </Link>
      </Button>
      <span className="hidden text-sm text-muted-foreground sm:inline">/ {typeName}</span>
      <span className="flex-1" />
      <span role="status" aria-live="polite" className={saveTone === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
        {saveLabel}
        {onRetry && (
          <button type="button" onClick={onRetry} className="ml-2 underline">
            Retry
          </button>
        )}
      </span>
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Details" onClick={onOpenDetails}>
        <PanelRight aria-hidden />
      </Button>
      {actions.secondary && (
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onAction(actions.secondary!.action)}>
          {actions.secondary.label}
        </Button>
      )}
      <Button size="sm" disabled={busy || actions.primary.disabled} onClick={() => onAction(actions.primary.action)}>
        {actions.primary.label}
      </Button>
      {actions.menu.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {safeMenu.map((m) => (
              <DropdownMenuItem key={m.action} onSelect={() => onAction(m.action)}>{m.label}</DropdownMenuItem>
            ))}
            {dangerMenu.length > 0 && <DropdownMenuSeparator />}
            {dangerMenu.map((m) => (
              <DropdownMenuItem key={m.action} className="text-destructive focus:text-destructive" onSelect={() => onAction(m.action)}>
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
