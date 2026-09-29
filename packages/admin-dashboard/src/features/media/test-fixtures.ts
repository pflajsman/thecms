import type { MediaFile, PaginatedResponse } from '@/types'

export function makeMedia(over: Partial<MediaFile> = {}): MediaFile {
  return {
    id: 'm1',
    filename: 'a1b2-sumava.jpg',
    originalName: 'sumava.jpg',
    mimeType: 'image/jpeg',
    size: 245_000,
    blobUrl: 'http://blob/media/a1b2-sumava.jpg',
    width: 1600,
    height: 1067,
    thumbnailUrl: 'http://blob/media/a1b2-sumava-thumbnail.jpg',
    variants: [
      { name: 'thumbnail', width: 150, height: 100, url: 'http://blob/media/a1b2-sumava-thumbnail.jpg', size: 8000 },
      { name: 'small', width: 400, height: 267, url: 'http://blob/media/a1b2-sumava-small.jpg', size: 30000 },
    ],
    tags: [],
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-20T10:00:00Z',
    ...over,
  }
}

export function mediaPage(items: MediaFile[], total = items.length, page = 1, limit = 24): PaginatedResponse<MediaFile> {
  return { success: true, data: items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } }
}
