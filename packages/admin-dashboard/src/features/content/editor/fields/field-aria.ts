import type { Field } from '@/types'

export interface FieldControlProps {
  field: Field
  id: string
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  error?: string
  disabled?: boolean
}

/** ARIA props every input gets: invalid state and a link to its help or error text. */
export function describedBy(id: string, field: Field, error?: string) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : field.description ? `${id}-help` : undefined,
  }
}
