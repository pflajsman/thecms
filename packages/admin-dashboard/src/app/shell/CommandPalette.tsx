import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { AppModule, CreateAction } from '@/modules/types'
import { CommandPaletteContext } from './command-palette-context'

interface ProviderProps {
  modules: AppModule[]
  actions: CreateAction[]
  children: ReactNode
}

export function CommandPaletteProvider({ modules, actions, children }: ProviderProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const value = useMemo(() => ({ open, setOpen }), [open])

  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search or jump to a page or action">
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Go to">
            {modules.map((m) => (
              <CommandItem key={m.id} value={m.label} onSelect={() => go(m.path)}>
                <m.icon aria-hidden />
                {m.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Create">
            {actions.map((a) => (
              <CommandItem key={a.id} value={a.label} onSelect={() => go(a.to)}>
                <a.icon aria-hidden />
                {a.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  )
}
