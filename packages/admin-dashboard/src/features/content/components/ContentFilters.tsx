import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { ContentType, EntryStatus } from '@/types'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ContentListParams, ContentSort } from '../list-params'

interface ContentFiltersProps {
  types: ContentType[]
  counts?: Record<string, number>
  params: ContentListParams
  update: (patch: Partial<ContentListParams>) => void
}

const ANY = 'any'

export function ContentFilters({ types, counts, params, update }: ContentFiltersProps) {
  const [search, setSearch] = useState(params.q ?? '')
  const debounced = useDebouncedValue(search, 300)

  useEffect(() => {
    const next = debounced.trim() || undefined
    if (next !== params.q) update({ q: next })
    // Only react to the debounced text; params.q changes elsewhere are mirrored below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search entries"
            placeholder="Search by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-full pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={params.status ?? ANY} onValueChange={(v) => update({ status: v === ANY ? undefined : (v as EntryStatus) })}>
            <SelectTrigger aria-label="Status" className="w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={params.sort} onValueChange={(v) => update({ sort: v as ContentSort })}>
            <SelectTrigger aria-label="Sort" className="w-40 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Last edited</SelectItem>
              <SelectItem value="createdAt">Created</SelectItem>
              <SelectItem value="title">Title A to Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Content model">
        <Chip active={!params.type} onClick={() => update({ type: undefined })}>
          All types
        </Chip>
        {types.map((t) => (
          <Chip key={t.id} active={params.type === t.id} onClick={() => update({ type: t.id })}>
            {t.name}
            {counts?.[t.id] !== undefined && <span className="ml-1.5 text-xs opacity-70">{counts[t.id]}</span>}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}
