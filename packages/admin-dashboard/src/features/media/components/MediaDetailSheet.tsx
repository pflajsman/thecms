import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { MediaFile } from '@/types'
import { apiErrorMessage } from '@/lib/api-error'
import { formatAbsolute } from '@/lib/format'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatusPill } from '@/components/common/StatusPill'
import { useMedia, useMediaUsage, useMediaWrites } from '../queries'
import { formatBytes, isImage, originalUrl } from '../media-utils'
import { MediaThumb } from './MediaTile'

interface MediaDetailSheetProps {
  mediaId?: string
  onOpenChange: (open: boolean) => void
}

export function MediaDetailSheet({ mediaId, onOpenChange }: MediaDetailSheetProps) {
  const media = useMedia(mediaId)
  const { t } = useTranslation('media')
  return (
    <Sheet open={!!mediaId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {media.data ? (
          <MediaDetails key={media.data.id} media={media.data} onDeleted={() => onOpenChange(false)} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{t('detail.loading')}</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 px-4"><Skeleton className="aspect-video w-full" /><Skeleton className="h-10 w-full" /></div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function MediaDetails({ media, onDeleted }: { media: MediaFile; onDeleted: () => void }) {
  const { t } = useTranslation('media')
  const writes = useMediaWrites()
  const usage = useMediaUsage(media.id)
  const [altText, setAltText] = useState(media.altText ?? '')
  const [description, setDescription] = useState(media.description ?? '')
  const [tags, setTags] = useState((media.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean)
  const dirty = altText !== (media.altText ?? '') || description !== (media.description ?? '') || parsedTags.join(',') !== (media.tags ?? []).join(',')
  const usedIn = usage.data ?? []

  const save = async () => {
    setSaving(true)
    try {
      await writes.update(media.id, { altText, description, tags: parsedTags })
      toast.success(t('detail.saved'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    try {
      await writes.remove(media.id)
      toast.success(t('detail.deleted', { name: media.originalName }))
      onDeleted()
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const copy = (url: string, label: string) => {
    void navigator.clipboard?.writeText(url).then(() => toast.success(t('detail.urlCopied', { label })))
  }

  const urls = [{ label: t('detail.original'), url: originalUrl(media) }, ...(media.variants ?? []).map((v) => ({ label: t('detail.variant', { name: t(`detail.variants.${v.name}`, { defaultValue: `${v.name[0].toUpperCase()}${v.name.slice(1)}` }), size: `${v.width}×${v.height}` }), url: v.url }))]

  return (
    <>
      <SheetHeader>
        <SheetTitle className="truncate font-serif text-xl">{media.originalName}</SheetTitle>
        <SheetDescription>
          {[media.width && media.height ? `${media.width}×${media.height}` : null, formatBytes(media.size), media.mimeType].filter(Boolean).join(' · ')}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
          <MediaThumb media={media} size="medium" className="object-contain" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="media-alt">{t('detail.altText')}</Label>
          <Input id="media-alt" value={altText} onChange={(e) => setAltText(e.target.value)} maxLength={200} />
          {isImage(media) && !altText.trim() && (
            <p className="flex items-start gap-1.5 text-sm text-status-draft-fg">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t('detail.altHint')}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-description">{t('detail.description')}</Label>
          <Textarea id="media-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="media-tags">{t('detail.tags')}</Label>
          <Input id="media-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('detail.tagsPlaceholder')} />
        </div>
        <Button onClick={() => void save()} disabled={!dirty || saving} className="self-start">
          {saving ? t('detail.saving') : t('actions.save', { ns: 'common' })}
        </Button>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('detail.links')}</h3>
          <ul className="flex flex-col gap-1">
            {urls.map((u) => (
              <li key={u.url} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{u.label}</span>
                <Button variant="ghost" size="sm" onClick={() => copy(u.url, u.label)} aria-label={t('detail.copyUrl', { label: u.label })}>
                  <Copy aria-hidden />
                  {t('actions.copy', { ns: 'common' })}
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('detail.usedIn')}</h3>
          {usage.isPending ? (
            <Skeleton className="h-8 w-full" />
          ) : usage.isError ? (
            <p className="text-sm text-destructive">{t('detail.usageError')}</p>
          ) : usedIn.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('detail.unused')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {usedIn.map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-sm">
                  <Link to={`/content/${u.id}`} className="min-w-0 flex-1 truncate hover:underline">{u.title}</Link>
                  <span className="text-xs text-muted-foreground">{u.contentType.name}</span>
                  <StatusPill status={u.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground">{t('detail.uploaded', { date: formatAbsolute(media.createdAt) })}</p>
        <Button variant="outline" className="self-start text-destructive" disabled={usage.isPending} onClick={() => setConfirmDelete(true)}>
          {t('detail.deleteFile')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('detail.deleteTitle', { name: media.originalName })}
        description={
          usage.isError
            ? t('detail.deleteUnknown')
            : usedIn.length > 0
            ? `${t('detail.usedBy', { count: usedIn.length })} ${t('detail.usedByConsequence')}`
            : t('detail.deletePermanent')
        }
        confirmLabel={t('actions.delete', { ns: 'common' })}
        destructive
        onConfirm={() => void remove()}
      />
    </>
  )
}
