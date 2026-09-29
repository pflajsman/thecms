import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'

export interface MediaFilterValue {
  category?: 'image' | 'document' | 'video'
  search: string
}

const CATEGORIES: { value?: MediaFilterValue['category']; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'document', label: 'Documents' },
  { value: 'video', label: 'Video' },
]

export function MediaFilters({ value, onChange, hideCategories = false }: { value: MediaFilterValue; onChange: (v: MediaFilterValue) => void; hideCategories?: boolean }) {
  const [search, setSearch] = useState(value.search)
  const debounced = useDebouncedValue(search, 300)

  // Mirror outside changes (back/forward, reset) into the input.
  const [synced, setSynced] = useState(value.search)
  if (value.search !== synced) {
    setSynced(value.search)
    if (value.search !== search.trim()) setSearch(value.search)
  }

  useEffect(() => {
    const next = debounced.trim()
    if (next !== value.search) onChange({ search: next, category: value.category })
    // Only react to the debounced text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      {!hideCategories && (
        <div role="group" aria-label="File type" className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => {
            const active = value.category === c.value
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ search: value.search, category: c.value })}
                className={cn('shrink-0 rounded-full border px-3 py-1 text-sm', active ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent')}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      )}
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" aria-label="Search media" placeholder="Search by name, alt text or tag…" value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-full pl-9" />
      </div>
    </div>
  )
}
