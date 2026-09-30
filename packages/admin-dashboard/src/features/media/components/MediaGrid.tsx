import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { MediaFile } from '@/types'
import { cn } from '@/lib/utils'
import { MediaThumb } from './MediaTile'

interface MediaGridProps {
  items: MediaFile[]
  label: string
  mode?: 'open' | 'select'
  selectedIds?: string[]
  disabled?: (m: MediaFile) => boolean
  onActivate: (m: MediaFile) => void
}

export function MediaGrid({ items, label, mode = 'open', selectedIds = [], disabled, onActivate }: MediaGridProps) {
  const { t } = useTranslation('media')
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {items.map((m) => {
        const selected = selectedIds.includes(m.id)
        const isDisabled = disabled?.(m) ?? false
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onActivate(m)}
              disabled={isDisabled}
              aria-pressed={mode === 'select' ? selected : undefined}
              title={isDisabled ? t('grid.notAllowed') : m.originalName}
              className={cn(
                'group relative block w-full overflow-hidden rounded-lg border bg-card text-left focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-40',
                selected && 'ring-2 ring-primary',
              )}
            >
              <div className="aspect-square">
                <MediaThumb media={m} />
              </div>
              <span className="block truncate px-2 py-1.5 text-xs">{m.originalName}</span>
              {selected && (
                <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check aria-hidden className="size-4" />
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
