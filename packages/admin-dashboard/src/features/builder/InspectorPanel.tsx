import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useIsDesktop } from '@/lib/hooks/useMediaQuery'

interface InspectorPanelProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

/** Field settings: a side panel on desktop, a bottom sheet on smaller screens. */
export function InspectorPanel({ title, open, onClose, children }: InspectorPanelProps) {
  const desktop = useIsDesktop()
  if (!open) return null
  if (desktop) {
    return (
      <aside aria-label={title} className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="Close field settings" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
        {children}
      </aside>
    )
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
