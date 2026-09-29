import { ArrowDown, ArrowUp, GripVertical, Star } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { moveItem } from '@/features/media/move-item'

export interface FieldListItem {
  id: string
  label: string
  apiKey: string
  typeLabel: string
  isTitle?: boolean
  hasError?: boolean
}

interface FieldListProps {
  label: string
  items: FieldListItem[]
  selectedId?: string
  onSelect: (id: string) => void
  onReorder: (ids: string[]) => void
}

export function FieldList({ label, items, selectedId, onSelect, onReorder }: FieldListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const ids = items.map((i) => i.id)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    onReorder(moveItem(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul aria-label={label} className="flex flex-col gap-1.5">
          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              first={index === 0}
              last={index === items.length - 1}
              onSelect={() => onSelect(item.id)}
              onMove={(delta) => onReorder(moveItem(ids, index, index + delta))}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

interface RowProps {
  item: FieldListItem
  selected: boolean
  first: boolean
  last: boolean
  onSelect: () => void
  onMove: (delta: number) => void
}

function Row({ item, selected, first, last, onSelect, onMove }: RowProps) {
  const { listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-1 rounded-lg border bg-card pr-1', selected && 'border-primary ring-2 ring-primary/30')}
    >
      <span {...listeners} aria-hidden className="cursor-grab px-1.5 py-3 text-muted-foreground">
        <GripVertical className="size-4" />
      </span>
      <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.label || 'Untitled field'}</span>
          <span className="block truncate font-mono text-xs text-muted-foreground">{item.apiKey || 'no key'}</span>
        </span>
        {item.isTitle && (
          <span className="flex items-center text-status-draft-fg" title="Title field">
            <Star aria-hidden className="size-4 fill-current" />
            <span className="sr-only">Title field</span>
          </span>
        )}
        {item.hasError && (
          <span className="size-2 rounded-full bg-destructive">
            <span className="sr-only">Has errors</span>
          </span>
        )}
        <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground">{item.typeLabel}</span>
      </button>
      {!first && (
        <button type="button" onClick={() => onMove(-1)} aria-label={`Move ${item.label || item.apiKey} up`} className="rounded p-1 hover:bg-accent">
          <ArrowUp aria-hidden className="size-3.5" />
        </button>
      )}
      {!last && (
        <button type="button" onClick={() => onMove(1)} aria-label={`Move ${item.label || item.apiKey} down`} className="rounded p-1 hover:bg-accent">
          <ArrowDown aria-hidden className="size-3.5" />
        </button>
      )}
    </li>
  )
}
