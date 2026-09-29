import { FileText, Film, Route } from 'lucide-react'
import type { MediaFile } from '@/types'
import { cn } from '@/lib/utils'
import { mediaCategory, previewUrl } from '../media-utils'

const ICONS = { document: FileText, video: Film, gpx: Route } as const

export function MediaThumb({ media, size = 'small', className }: { media: MediaFile; size?: 'thumbnail' | 'small' | 'medium' | 'large'; className?: string }) {
  const src = previewUrl(media, size)
  const category = mediaCategory(media)
  if (src && category === 'image') {
    return <img src={src} alt={media.altText ?? ''} loading="lazy" className={cn('h-full w-full object-cover', className)} />
  }
  const Icon = category === 'image' ? FileText : ICONS[category]
  const ext = category === 'gpx' ? 'GPX' : (media.originalName.split('.').pop() ?? '').toUpperCase()
  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center gap-1 bg-secondary text-secondary-foreground', className)}>
      <Icon aria-hidden className="size-7" />
      <span className="text-[10px] font-semibold tracking-wide">{ext}</span>
    </div>
  )
}
