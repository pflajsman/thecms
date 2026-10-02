import type { Field } from '@/types'
import { toPlainText } from './rich-text-clean'

const MAX_CONTEXT_CHARS = 2000

/** The entry's other text fields as plain text for the AI prompt, each cut to 2,000 characters (the server trims further). */
export function aiContextFields(fields: Field[], values: Record<string, unknown>, exclude: string): { label: string; value: string }[] {
  return fields
    .filter((f) => f.name !== exclude && (f.type === 'TEXT' || f.type === 'RICH_TEXT'))
    .map((f) => {
      const raw = values[f.name]
      const text = toPlainText(typeof raw === 'string' ? raw : '')
      return { label: f.label || f.name, value: text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS)}…` : text }
    })
    .filter((f) => f.value)
}
