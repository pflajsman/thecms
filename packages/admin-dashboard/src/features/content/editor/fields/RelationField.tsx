import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { StatusPill } from '@/components/common/StatusPill'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useEntry, useEntryList } from '../../queries'
import { FieldShell } from './FieldShell'
import { describedBy, type FieldControlProps } from './field-aria'

const OBJECT_ID = /^[a-f0-9]{24}$/i

export function RelationField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  const multiple = !!field.validation?.multiple
  const selected = Array.isArray(value) ? (value as string[]) : typeof value === 'string' && value ? [value] : []
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 250)
  const target = field.validation?.targetContentType
  const results = useEntryList(
    { search: debounced || undefined, contentTypeId: target && OBJECT_ID.test(target) ? target : undefined, limit: 20 },
    { enabled: open },
  )

  const choose = (entryId: string) => {
    if (multiple) {
      onChange(selected.includes(entryId) ? selected.filter((s) => s !== entryId) : [...selected, entryId])
    } else {
      onChange(entryId)
      setOpen(false)
    }
  }
  const remove = (entryId: string) => onChange(multiple ? selected.filter((s) => s !== entryId) : undefined)

  return (
    <FieldShell field={field} id={id} error={error}>
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((entryId) => (
          <RelationChip key={entryId} id={entryId} onRemove={disabled ? undefined : () => remove(entryId)} />
        ))}
        {(multiple || selected.length === 0) && !disabled && (
          <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) onBlur() }}>
            <PopoverTrigger asChild>
              <Button id={id} variant="outline" size="sm" {...describedBy(id, field, error)}>
                <Plus aria-hidden />
                {selected.length ? 'Add entry' : 'Choose entry'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search entries…" value={search} onValueChange={setSearch} />
                <CommandList>
                  <CommandEmpty>{results.isFetching ? 'Searching…' : 'No entries found.'}</CommandEmpty>
                  <CommandGroup>
                    {(results.data?.data ?? []).map((entry) => (
                      <CommandItem key={entry.id} value={entry.id} onSelect={() => choose(entry.id)}>
                        <span className="flex-1 truncate">{entry.title}</span>
                        <span className="text-xs text-muted-foreground">{entry.contentType?.name}</span>
                        {selected.includes(entry.id) && <span className="sr-only">(selected)</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </FieldShell>
  )
}

function RelationChip({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const entry = useEntry(id)
  const title = entry.data?.title ?? (entry.isError ? 'Missing entry' : 'Loading…')
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
      <Link to={`/content/${id}`} className="max-w-48 truncate hover:underline">{title}</Link>
      {entry.data && <StatusPill status={entry.data.status} />}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${title}`} className="rounded-full p-1 hover:bg-accent">
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  )
}
