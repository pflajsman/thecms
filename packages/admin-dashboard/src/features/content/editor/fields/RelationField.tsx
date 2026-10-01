import { useTranslation } from 'react-i18next'
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
import { useLanguages } from '@/features/languages/languages-queries'
import type { EntryListItem } from '@/types'
import { describedBy, type FieldControlProps } from './field-aria'

const OBJECT_ID = /^[a-f0-9]{24}$/i

export function RelationField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  const { t } = useTranslation('editor')
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

  const defaultCode = useLanguages().data?.find((l) => l.isDefault)?.code
  const items = onePerItem(results.data?.data ?? [], defaultCode)

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
                {selected.length ? t('fields.addEntry') : t('fields.chooseEntry')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder={t('fields.searchEntries')} value={search} onValueChange={setSearch} />
                <CommandList>
                  <CommandEmpty>{results.isFetching ? t('fields.searching') : t('fields.noEntries')}</CommandEmpty>
                  <CommandGroup>
                    {items.map((entry) => {
                      // Relations store item ids, so they survive deleting one language version.
                      const itemId = entry.itemId ?? entry.id
                      return (
                        <CommandItem key={itemId} value={itemId} onSelect={() => choose(itemId)}>
                          <span className="flex-1 truncate">{entry.title}</span>
                          <span className="text-xs text-muted-foreground">{entry.contentType?.name}</span>
                          {selected.includes(itemId) && <span className="sr-only">{t('fields.selected')}</span>}
                        </CommandItem>
                      )
                    })}
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
  const { t } = useTranslation('editor')
  const entry = useEntry(id)
  const title = entry.data?.title ?? (entry.isError ? t('fields.missingEntry') : t('fields.loading'))
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
      <Link to={`/content/${id}`} className="max-w-48 truncate hover:underline">{title}</Link>
      {entry.data && <StatusPill status={entry.data.status} />}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t('fields.remove', { name: title })} className="rounded-full p-1 hover:bg-accent">
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  )
}

/** One row per item: its default-language version when listed, else the first version listed. */
function onePerItem(entries: EntryListItem[], defaultCode?: string): EntryListItem[] {
  const chosen = new Map<string, EntryListItem>()
  for (const e of entries) {
    const key = e.itemId ?? e.id
    const current = chosen.get(key)
    if (!current || (current.language !== defaultCode && e.language === defaultCode)) chosen.set(key, e)
  }
  return [...chosen.values()]
}
