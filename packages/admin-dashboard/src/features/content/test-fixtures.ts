import type { ContentEntry, ContentType, EntryListItem, PaginatedResponse } from '@/types'

export const tripType: ContentType = {
  id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  name: 'Trip',
  slug: 'trip',
  fields: [
    { name: 'title', label: 'Title', type: 'TEXT', required: true },
    { name: 'distanceKm', label: 'Distance (km)', type: 'NUMBER', required: false },
    { name: 'published', label: 'Show on home page', type: 'BOOLEAN', required: false },
  ],
  createdAt: '2026-09-01T10:00:00Z',
  updatedAt: '2026-09-01T10:00:00Z',
}

export const postType: ContentType = {
  ...tripType,
  id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  name: 'Blog post',
  slug: 'blog-post',
  fields: [{ name: 'title', label: 'Title', type: 'TEXT', required: true }],
}

export function makeEntry(over: Partial<ContentEntry> = {}): ContentEntry {
  return {
    id: 'e1',
    contentTypeId: tripType.id,
    data: { title: 'Přes Šumavu', distanceKm: 142 },
    title: 'Přes Šumavu',
    status: 'DRAFT',
    createdAt: '2026-09-20T10:00:00Z',
    updatedAt: '2026-09-29T10:00:00Z',
    ...over,
  }
}

export function makeListItem(over: Partial<EntryListItem> = {}): EntryListItem {
  const entry = makeEntry()
  delete entry.contentType
  return { ...entry, title: 'Přes Šumavu', contentType: { id: tripType.id, name: 'Trip', slug: 'trip' }, ...over }
}

export function page(items: EntryListItem[], total = items.length, pageNo = 1, limit = 20): PaginatedResponse<EntryListItem> {
  return { success: true, data: items, pagination: { page: pageNo, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } }
}
