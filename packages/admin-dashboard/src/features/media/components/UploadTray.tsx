import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UploadItem } from '../useUploadQueue'

export function UploadTray({ items, onClear }: { items: UploadItem[]; onClear: () => void }) {
  if (items.length === 0) return null
  const active = items.filter((i) => i.status === 'queued' || i.status === 'uploading').length
  return (
    <section
      aria-label="Uploads"
      className="fixed right-4 bottom-20 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg md:bottom-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium" aria-live="polite">
          {active > 0 ? `Uploading ${active} file${active === 1 ? '' : 's'}…` : 'Uploads finished'}
        </h2>
        {active === 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        )}
      </div>
      <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <div className="flex items-center gap-2">
              {item.status === 'done' && <CheckCircle2 aria-hidden className="size-4 text-status-published-fg" />}
              {item.status === 'error' && <AlertCircle aria-hidden className="size-4 text-destructive" />}
              {(item.status === 'queued' || item.status === 'uploading') && <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
            </div>
            {item.status === 'uploading' && (
              <div role="progressbar" aria-label={`Uploading ${item.name}`} aria-valuenow={Math.round(item.progress * 100)} aria-valuemin={0} aria-valuemax={100} className="mt-1 h-1 rounded-full bg-muted">
                <div className="h-1 rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(item.progress * 100)}%` }} />
              </div>
            )}
            {item.error && <p className="mt-0.5 text-xs text-destructive">{item.error}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
