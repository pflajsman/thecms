import type { ContentType, EntryListItem } from '@/types'

export function coverMediaId(entry: EntryListItem, type?: ContentType): string | undefined {
  const field = type?.fields.find((f) => f.type === 'MEDIA' && !f.validation?.multiple)
  const value = field ? entry.data[field.name] : undefined
  return typeof value === 'string' && value ? value : undefined
}
