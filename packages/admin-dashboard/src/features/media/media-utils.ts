import type { MediaFile } from '@/types'

export type MediaCategory = 'image' | 'document' | 'video' | 'gpx'
type MediaLike = Pick<MediaFile, 'mimeType' | 'originalName'>

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// Mirrors packages/backend/src/config/upload.ts ALL_ALLOWED_MIME_TYPES.
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/gpx+xml', 'application/xml', 'text/xml',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
])

function isGpxName(name: string) {
  return name.toLowerCase().endsWith('.gpx')
}

export function mediaCategory(m: MediaLike): MediaCategory {
  if (m.mimeType === 'application/gpx+xml' || isGpxName(m.originalName)) return 'gpx'
  if (m.mimeType.startsWith('image/')) return 'image'
  if (m.mimeType.startsWith('video/')) return 'video'
  return 'document'
}

export function isImage(m: MediaLike): boolean {
  return mediaCategory(m) === 'image'
}

export function originalUrl(m: Pick<MediaFile, 'cdnUrl' | 'blobUrl'>): string {
  return m.cdnUrl || m.blobUrl
}

export function previewUrl(m: MediaFile, size: 'thumbnail' | 'small' | 'medium' | 'large' = 'small'): string | undefined {
  const variant = m.variants?.find((v) => v.name === size)
  if (variant) return variant.url
  if (m.thumbnailUrl) return m.thumbnailUrl
  return isImage(m) ? originalUrl(m) : undefined
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateUpload(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return `${file.name} is larger than 10 MB.`
  if (!ALLOWED_TYPES.has(file.type) && !isGpxName(file.name)) return `${file.name} is not a supported file type.`
  return null
}

export function matchesAccept(m: MediaLike, accept?: string[]): boolean {
  if (!accept || accept.length === 0) return true
  return accept.some((rule) => {
    if (rule.endsWith('/*')) return m.mimeType.startsWith(rule.slice(0, -1))
    if (rule === 'application/gpx+xml') return mediaCategory(m) === 'gpx'
    return m.mimeType === rule
  })
}
