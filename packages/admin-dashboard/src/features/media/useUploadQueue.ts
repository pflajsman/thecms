import { useCallback, useEffect, useRef, useState } from 'react'
import type { MediaFile } from '@/types'
import { apiErrorMessage } from '@/lib/api-error'
import { uploadMedia } from './media-api'
import { validateUpload } from './media-utils'

export interface UploadItem {
  id: string
  name: string
  progress: number
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
  media?: MediaFile
}

interface Options {
  onUploaded?: (media: MediaFile) => void
  concurrency?: number
  upload?: typeof uploadMedia
}

export function useUploadQueue({ onUploaded, concurrency = 3, upload = uploadMedia }: Options = {}) {
  const [items, setItems] = useState<UploadItem[]>([])
  const pendingRef = useRef<{ id: string; file: File }[]>([])
  const activeRef = useRef(0)
  const nextIdRef = useRef(0)
  const optionsRef = useRef({ onUploaded, concurrency, upload })
  useEffect(() => {
    optionsRef.current = { onUploaded, concurrency, upload }
  })

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...change } : item)))
  }, [])

  const pump = useCallback(() => {
    const step = () => {
      const { concurrency: limit, upload: run } = optionsRef.current
      while (activeRef.current < limit && pendingRef.current.length > 0) {
        const next = pendingRef.current.shift()!
        activeRef.current += 1
        patch(next.id, { status: 'uploading' })
        run(next.file, (progress) => patch(next.id, { progress }))
          .then((media) => {
            patch(next.id, { status: 'done', progress: 1, media })
            optionsRef.current.onUploaded?.(media)
          })
          .catch((error) => patch(next.id, { status: 'error', error: apiErrorMessage(error) }))
          .finally(() => {
            activeRef.current -= 1
            step()
          })
      }
    }
    step()
  }, [patch])

  const add = useCallback(
    (files: File[]) => {
      const created: UploadItem[] = files.map((file) => {
        const error = validateUpload(file)
        const id = `upload-${nextIdRef.current++}`
        if (!error) pendingRef.current.push({ id, file })
        return { id, name: file.name, progress: 0, status: error ? 'error' : 'queued', error: error ?? undefined }
      })
      setItems((prev) => [...prev, ...created])
      pump()
    },
    [pump],
  )

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status === 'queued' || item.status === 'uploading'))
  }, [])

  return { items, add, clearFinished }
}
