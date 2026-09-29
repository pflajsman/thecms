import { useState } from 'react'
import { Upload } from 'lucide-react'
import type { MediaFile } from '@/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Pager } from '@/components/common/Pager'
import { useMediaList, useMediaWrites } from '../queries'
import { useUploadQueue } from '../useUploadQueue'
import { matchesAccept } from '../media-utils'
import { MediaGrid } from './MediaGrid'
import { MediaFilters, type MediaFilterValue } from './MediaFilters'
import { UploadTray } from './UploadTray'

interface MediaPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (media: MediaFile[]) => void
  multiple?: boolean
  /** MIME rules such as "image/*" or "application/gpx+xml". */
  accept?: string[]
}

const PAGE_SIZE = 20

export function MediaPickerDialog({ open, onOpenChange, onSelect, multiple = false, accept }: MediaPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        {open && <PickerBody onSelect={(m) => { onSelect(m); onOpenChange(false) }} multiple={multiple} accept={accept} />}
      </DialogContent>
    </Dialog>
  )
}

function PickerBody({ onSelect, multiple, accept }: { onSelect: (m: MediaFile[]) => void; multiple: boolean; accept?: string[] }) {
  const imagesOnly = !!accept && accept.length > 0 && accept.every((a) => a.startsWith('image/'))
  const [filters, setFilters] = useState<MediaFilterValue>({ search: '', category: imagesOnly ? 'image' : undefined })
  const [pageNo, setPageNo] = useState(1)
  const [selected, setSelected] = useState<MediaFile[]>([])
  const [rejected, setRejected] = useState<string | null>(null)
  const writes = useMediaWrites()
  const list = useMediaList({ category: filters.category, search: filters.search || undefined, page: pageNo, limit: PAGE_SIZE })

  const toggle = (m: MediaFile) => {
    setSelected((prev) => {
      if (prev.some((s) => s.id === m.id)) return prev.filter((s) => s.id !== m.id)
      return multiple ? [...prev, m] : [m]
    })
  }

  const uploads = useUploadQueue({
    onUploaded: (m) => {
      writes.invalidate()
      if (matchesAccept(m, accept)) setSelected((prev) => (multiple ? [...prev, m] : [m]))
    },
  })

  const items = list.data?.data ?? []
  const shown = [...selected.filter((s) => !items.some((i) => i.id === s.id)), ...items]

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">Choose {multiple ? 'files' : 'a file'}</DialogTitle>
        <DialogDescription>Pick from your library or upload new files.</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-accent">
          <Upload aria-hidden className="size-4" />
          Upload
          <input
            type="file"
            multiple={multiple}
            accept={accept?.join(',')}
            aria-label="Upload files"
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              const bad = files.filter((f) => !matchesAccept({ mimeType: f.type, originalName: f.name }, accept))
              setRejected(bad.length ? bad.map((f) => `${f.name} is not allowed here.`).join(' ') : null)
              uploads.add(files.filter((f) => !bad.includes(f)))
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {rejected && <p role="alert" className="text-sm text-destructive">{rejected}</p>}
      <MediaFilters value={filters} hideCategories={imagesOnly} onChange={(v) => { setFilters(v); setPageNo(1) }} />
      {list.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-square w-full" />)}</div>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No files found. Upload one to get started.</p>
      ) : (
        <MediaGrid label="Files" mode="select" items={shown} selectedIds={selected.map((s) => s.id)} disabled={(m) => !matchesAccept(m, accept)} onActivate={toggle} />
      )}
      {list.data && <Pager page={pageNo} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={setPageNo} />}
      <UploadTray inline items={uploads.items} onClear={uploads.clearFinished} />
      <DialogFooter>
        <Button disabled={selected.length === 0} onClick={() => onSelect(selected)}>
          {selected.length === 0 ? 'Choose' : `Choose ${selected.length} file${selected.length === 1 ? '' : 's'}`}
        </Button>
      </DialogFooter>
    </>
  )
}
