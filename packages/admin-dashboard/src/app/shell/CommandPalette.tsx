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
import { FileText } from 'lucide-react'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useEntryList } from '@/features/content/queries'
import { CommandPaletteContext } from './command-palette-context'

interface ProviderProps {
  modules: AppModule[]
  actions: CreateAction[]
  children: ReactNode
}

export function CommandPaletteProvider({ modules, actions, children }: ProviderProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const debouncedQuery = useDebouncedValue(query.trim(), 250)
  const entrySearch = useEntryList(
    { search: debouncedQuery, limit: 8, sortBy: 'updatedAt' },
    { enabled: open && debouncedQuery.length >= 2 },
  )
  const entries = debouncedQuery.length >= 2 ? entrySearch.data?.data ?? [] : []

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typeof event.key === 'string' && event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
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
    setQuery('')
    navigate(to)
  }

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Search or jump to a page or action">
        <CommandInput placeholder="Search or jump to…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {entries.length > 0 && (
            <CommandGroup heading="Entries">
              {entries.map((e) => (
                <CommandItem key={e.id} value={`entry-${e.id}`} keywords={[e.title, debouncedQuery]} onSelect={() => go(`/content/${e.id}`)}>
                  <FileText aria-hidden />
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-muted-foreground">{e.contentType?.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
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
