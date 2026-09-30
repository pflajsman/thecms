import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ImagePlus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Pager } from '@/components/common/Pager'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaList, useMediaWrites } from '../queries'
import { useUploadQueue } from '../useUploadQueue'
import { useFileDrop } from '../useFileDrop'
import { MediaGrid } from '../components/MediaGrid'
import { MediaFilters, type MediaFilterValue } from '../components/MediaFilters'
import { MediaDetailSheet } from '../components/MediaDetailSheet'
import { UploadTray } from '../components/UploadTray'

const PAGE_SIZE = 24
const CATEGORIES = ['image', 'document', 'video'] as const

export function MediaLibraryPage() {
  const [sp, setSp] = useSearchParams()
  const { t } = useTranslation('media')
  const category = CATEGORIES.find((c) => c === sp.get('category'))
  const search = (sp.get('q') ?? '').slice(0, 100)
  const pageNo = Math.max(1, Number.parseInt(sp.get('page') ?? '1', 10) || 1)
  const itemId = sp.get('item') ?? undefined

  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp)
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      setSp(next, { replace: true })
    },
    [sp, setSp],
  )

  const list = useMediaList({ category, search: search || undefined, page: pageNo, limit: PAGE_SIZE })
  const writes = useMediaWrites()
  const uploads = useUploadQueue({ onUploaded: () => writes.invalidate() })
  const fileInput = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: File[]) => {
    uploads.add(files)
    if (files.length) toast.message(t('upload.uploadingCount', { count: files.length }))
  }, [uploads, t])
  const { dragging } = useFileDrop(addFiles)

  const filters: MediaFilterValue = useMemo(() => ({ category, search }), [category, search])

  let body: React.ReactNode
  if (list.isPending) {
    body = (
      <div role="status" aria-busy="true" aria-label={t('library.loading')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-square w-full rounded-lg" />)}
      </div>
    )
  } else if (list.isError) {
    body = <ErrorState message={t('library.loadError')} onRetry={() => void list.refetch()} />
  } else if (list.data.data.length === 0) {
    body = category || search
      ? <EmptyState icon={ImagePlus} title={t('library.noMatch')} action={<Button variant="outline" onClick={() => setParams({ category: undefined, q: undefined, page: undefined })}>{t('library.clearFilters')}</Button>} />
      : <EmptyState icon={ImagePlus} title={t('library.emptyTitle')} description={t('library.emptyText')} action={<Button onClick={() => fileInput.current?.click()}>{t('library.uploadFiles')}</Button>} />
  } else {
    body = (
      <>
        <MediaGrid label={t('title')} items={list.data.data} onActivate={(m) => setParams({ item: m.id })} />
        <Pager page={pageNo} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={(p) => setParams({ page: p > 1 ? String(p) : undefined })} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('library.description')}
        actions={
          <Button onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden />
            {t('uploadButton')}
          </Button>
        }
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        aria-hidden
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <MediaFilters value={filters} onChange={(v) => setParams({ category: v.category, q: v.search || undefined, page: undefined })} />
      {body}
      <MediaDetailSheet mediaId={itemId} onOpenChange={(open) => !open && setParams({ item: undefined })} />
      <UploadTray items={uploads.items} onClear={uploads.clearFinished} />
      {dragging && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary px-10 py-8 font-serif text-2xl">{t('library.dropOverlay')}</div>
        </div>
      )}
    </>
  )
}
