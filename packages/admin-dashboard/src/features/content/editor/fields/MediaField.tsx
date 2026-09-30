import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Upload, X } from 'lucide-react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MediaFile } from '@/types'
import { Button } from '@/components/ui/button'
import { useMediaByIds, useMediaWrites } from '@/features/media/queries'
import { useUploadQueue } from '@/features/media/useUploadQueue'
import { matchesAccept } from '@/features/media/media-utils'
import { moveItem } from '@/features/media/move-item'
import { MediaThumb } from '@/features/media/components/MediaTile'
import { MediaPickerDialog } from '@/features/media/components/MediaPickerDialog'
import { FieldShell } from './FieldShell'
import { describedBy, type FieldControlProps } from './field-aria'

export function MediaField({ field, id, value, onChange, onBlur, error, disabled }: FieldControlProps) {
  const { t } = useTranslation('editor')
  const multiple = !!field.validation?.multiple
  const accept = field.validation?.allowedMimeTypes
  const ids = multiple ? (Array.isArray(value) ? (value as string[]) : []) : typeof value === 'string' && value ? [value] : []
  const { byId, isLoading, isError, refetch } = useMediaByIds(ids)
  // Uploads finish asynchronously; append to the latest value, not the one from their render.
  const idsRef = useRef(ids)
  useEffect(() => {
    idsRef.current = ids
  })
  const writes = useMediaWrites()
  const [pickerOpen, setPickerOpen] = useState(false)
  // File names only; the message is built at render so it follows a language switch.
  const [rejectedNames, setRejectedNames] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const commit = (next: string[]) => {
    idsRef.current = next
    onChange(multiple ? next : next[0])
    onBlur()
  }
  const add = (media: MediaFile[]) => {
    const current = idsRef.current
    commit(multiple ? [...current, ...media.map((m) => m.id).filter((m) => !current.includes(m))] : media.slice(-1).map((m) => m.id))
  }

  const uploads = useUploadQueue({
    onUploaded: (m) => {
      writes.invalidate()
      add([m])
    },
  })

  const uploadErrors = uploads.items
    .filter((u) => u.status === 'error' && u.error)
    .map((u) => (u.error!.startsWith(u.name) ? u.error! : `${u.name}: ${u.error}`))

  const upload = (files: File[]) => {
    const rejected = files.filter((f) => !matchesAccept({ mimeType: f.type, originalName: f.name }, accept))
    setRejectedNames(rejected.map((f) => f.name))
    const ok = files.filter((f) => !rejected.includes(f))
    uploads.add(multiple ? ok : ok.slice(0, 1))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (disabled) return
    upload(Array.from(e.dataTransfer?.files ?? []))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    commit(moveItem(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <FieldShell field={field} id={id} error={error ?? ([...rejectedNames.map((name) => t('fields.notAllowed', { name, label: field.label || field.name })), ...uploadErrors].join(' ') || undefined)}>
      <div
        role="group"
        aria-label={field.label || field.name}
        onDragOver={(e) => { if (!disabled) { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-lg border border-dashed p-3 transition-colors ${dragOver ? 'border-primary bg-accent' : 'bg-card'}`}
      >
        {ids.length > 0 && isError && (
          <p className="mb-3 flex items-center gap-2 text-sm text-destructive" role="alert">
            {t('fields.loadFilesError')}
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>{t('fields.retry')}</Button>
          </p>
        )}
        {ids.length > 0 && !isError && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <ul aria-label={t('fields.filesLabel', { label: field.label || field.name })} className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {ids.map((mediaId, index) => (
                  <MediaItem
                    key={mediaId}
                    mediaId={mediaId}
                    media={byId.get(mediaId)}
                    loading={isLoading}
                    sortable={multiple && !disabled}
                    first={index === 0}
                    last={index === ids.length - 1}
                    onMove={(delta) => commit(moveItem(ids, index, index + delta))}
                    onRemove={disabled ? undefined : () => commit(ids.filter((x) => x !== mediaId))}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
        {!disabled && (
          <div className="flex flex-wrap items-center gap-2">
            <Button id={id} type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)} {...describedBy(id, field, error)}>
              <ImagePlus aria-hidden />
              {ids.length && !multiple ? t('fields.replace') : t('fields.chooseFromLibrary')}
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm hover:bg-accent">
              <Upload aria-hidden className="size-4" />
              {t('fields.upload')}
              <input type="file" multiple={multiple} className="sr-only" aria-label={t('fields.uploadTo', { label: field.label || field.name })} onChange={(e) => { upload(Array.from(e.target.files ?? [])); e.target.value = '' }} />
            </label>
            <span className="text-xs text-muted-foreground">{t('fields.dropHint')}</span>
          </div>
        )}
        {uploads.items.some((u) => u.status === 'uploading' || u.status === 'queued') && (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{t('fields.uploading')}</p>
        )}
      </div>
      <MediaPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onSelect={add} multiple={multiple} accept={accept} />
    </FieldShell>
  )
}

interface MediaItemProps {
  mediaId: string
  media?: MediaFile
  loading: boolean
  sortable: boolean
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onRemove?: () => void
}

function MediaItem({ mediaId, media, loading, sortable, first, last, onMove, onRemove }: MediaItemProps) {
  const { t } = useTranslation('editor')
  const { listeners, setNodeRef, transform, transition } = useSortable({ id: mediaId, disabled: !sortable })
  const name = media?.originalName ?? (loading ? t('fields.loadingFile') : t('fields.missingFile'))
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="group relative overflow-hidden rounded-md border bg-background">
      <div className="aspect-square">
        {media ? <MediaThumb media={media} size="thumbnail" /> : (
          <div className="grid h-full place-items-center p-2 text-center text-xs text-muted-foreground">{loading ? '' : t('fields.missingFile')}</div>
        )}
      </div>
      <p className="truncate px-1.5 py-1 text-[11px]">{media?.originalName ?? (loading ? '…' : '')}</p>
      <div className="absolute inset-x-0 top-0 flex justify-between p-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        {sortable ? (
          <span className="flex gap-0.5">
            <span {...listeners} aria-hidden title={t('fields.dragToReorder')} className="cursor-grab rounded bg-background/90 p-0.5"><GripVertical className="size-3.5" /></span>
            {!first && <button type="button" onClick={() => onMove(-1)} aria-label={t('fields.moveEarlier', { name })} className="rounded bg-background/90 p-0.5"><ArrowLeft aria-hidden className="size-3.5" /></button>}
            {!last && <button type="button" onClick={() => onMove(1)} aria-label={t('fields.moveLater', { name })} className="rounded bg-background/90 p-0.5"><ArrowRight aria-hidden className="size-3.5" /></button>}
          </span>
        ) : <span />}
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={t('fields.remove', { name: media ? media.originalName : t('fields.missingFileLower') })} className="rounded bg-background/90 p-0.5">
            <X aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
    </li>
  )
}
