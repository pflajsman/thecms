import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { apiErrorMessage } from '@/lib/api-error'
import { formatBytes } from '@/features/media/media-utils'
import type { DigitalFile } from '../commerce-api'
import { useCommerceWrites } from '../commerce-queries'

export function DigitalFileSection({ productId, file }: { productId: string; file?: DigitalFile }) {
  const { t } = useTranslation('commerce')
  const writes = useCommerceWrites()
  const input = useRef<HTMLInputElement>(null)
  const [current, setCurrent] = useState<DigitalFile | undefined>(file)
  const [pending, setPending] = useState(false)

  const upload = async (chosen: File) => {
    setPending(true)
    try {
      setCurrent(await writes.uploadFile(productId, chosen))
      toast.success(t('file.uploaded'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setPending(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <section aria-labelledby="file-title" className="space-y-3">
      <div>
        <h2 id="file-title" className="font-serif text-xl font-semibold">{t('file.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('file.hint')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        {current ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{current.originalName}</span>
            <span className="flex gap-1.5 text-xs text-muted-foreground">
              <span>{current.mimeType}</span>
              <span aria-hidden>·</span>
              <span>{formatBytes(current.size)}</span>
            </span>
          </span>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">{t('file.none')}</span>
        )}
        <input
          ref={input}
          type="file"
          aria-label={t('file.upload')}
          className="sr-only"
          onChange={(e) => {
            const chosen = e.target.files?.[0]
            if (chosen) void upload(chosen)
          }}
        />
        <Button variant="outline" disabled={pending} onClick={() => input.current?.click()}>
          <Upload aria-hidden />
          {pending ? t('file.uploading') : current ? t('file.replace') : t('file.upload')}
        </Button>
      </div>
    </section>
  )
}
