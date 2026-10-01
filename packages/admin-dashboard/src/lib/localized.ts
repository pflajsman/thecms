import type { Field } from '@/types'

/** Same rule as the backend (utils/localized.ts): TEXT and RICH_TEXT are translated unless set otherwise. */
export function isLocalized(field: Pick<Field, 'type' | 'localized'>): boolean {
  if (field.localized !== undefined) return field.localized
  return field.type === 'TEXT' || field.type === 'RICH_TEXT'
}
