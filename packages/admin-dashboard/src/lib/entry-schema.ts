import { z } from 'zod'
import { formatDate } from '@/lib/format'
import type { Field } from '@/types'

export type EntryValues = Record<string, unknown>

export const UNTITLED = 'Untitled'

const EMPTY_HTML = /^(\s|&nbsp;|<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>|<br\s*\/?>)*$/i

/** Same rule as the backend: explicit TEXT titleField, else the first TEXT field. */
export function resolveTitleField(fields: Pick<Field, 'name' | 'type'>[], titleField?: string): string | undefined {
  if (titleField && fields.some((f) => f.name === titleField && f.type === 'TEXT')) return titleField
  return fields.find((f) => f.type === 'TEXT')?.name
}

export function isEmptyValue(field: Pick<Field, 'type'>, value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'number') return Number.isNaN(value)
  if (typeof value === 'string') return field.type === 'RICH_TEXT' ? EMPTY_HTML.test(value) : value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function safeRegExp(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

function fieldError(field: Field, value: unknown): string | null {
  const label = field.label || field.name
  const rules = field.validation ?? {}

  switch (field.type) {
    case 'TEXT': {
      if (typeof value !== 'string') return `${label} must be text`
      if (rules.minLength !== undefined && value.length < rules.minLength) return `${label} must be at least ${rules.minLength} characters`
      if (rules.maxLength !== undefined && value.length > rules.maxLength) return `${label} must be at most ${rules.maxLength} characters`
      const re = rules.pattern ? safeRegExp(rules.pattern) : null
      if (re && !re.test(value)) return `${label} does not match the required pattern`
      return null
    }
    case 'RICH_TEXT': {
      if (typeof value !== 'string') return `${label} must be text`
      if (rules.maxLength !== undefined && value.length > rules.maxLength) return `${label} must be at most ${rules.maxLength} characters`
      return null
    }
    case 'NUMBER': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${label} must be a number`
      if (rules.integer && !Number.isInteger(value)) return `${label} must be a whole number`
      if (rules.min !== undefined && value < rules.min) return `${label} must be at least ${rules.min}`
      if (rules.max !== undefined && value > rules.max) return `${label} must be at most ${rules.max}`
      return null
    }
    case 'DATE': {
      const time = typeof value === 'string' ? new Date(value).getTime() : Number.NaN
      if (Number.isNaN(time)) return `${label} must be a valid date`
      if (rules.minDate && time < new Date(rules.minDate).getTime()) return `${label} must be on or after ${formatDate(rules.minDate)}`
      if (rules.maxDate && time > new Date(rules.maxDate).getTime()) return `${label} must be on or before ${formatDate(rules.maxDate)}`
      return null
    }
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : `${label} must be yes or no`
    case 'MEDIA':
    case 'RELATION': {
      if (rules.multiple) {
        return Array.isArray(value) && value.every((v) => typeof v === 'string') ? null : `${label} must be a list`
      }
      return typeof value === 'string' ? null : `${label} must be a single item`
    }
    default:
      return null
  }
}

/** Field name to its first error. Mirrors packages/backend/.../validation.helper.ts, plus: empty strings count as missing. */
export function validateEntry(fields: Field[], values: EntryValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const value = values[field.name]
    if (isEmptyValue(field, value)) {
      if (field.required) errors[field.name] = `${field.label || field.name} is required`
      continue
    }
    const error = fieldError(field, value)
    if (error) errors[field.name] = error
  }
  return errors
}

export function buildEntrySchema(fields: Field[]): z.ZodType<EntryValues> {
  return z.record(z.unknown()).superRefine((values, ctx) => {
    for (const [name, message] of Object.entries(validateEntry(fields, values))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message })
    }
  })
}

/** Data to send: empty model fields are omitted; data of fields no longer in the model is kept untouched. */
export function toEntryPayload(fields: Field[], values: EntryValues): EntryValues {
  const byName = new Map(fields.map((f) => [f.name, f]))
  const payload: EntryValues = {}
  for (const [name, value] of Object.entries(values)) {
    const field = byName.get(name)
    if (field && isEmptyValue(field, value)) continue
    payload[name] = value
  }
  return payload
}

export function createInitialValues(fields: Field[], data?: EntryValues): EntryValues {
  if (data) return { ...data }
  const values: EntryValues = {}
  for (const field of fields) {
    if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
      values[field.name] = field.defaultValue
    }
  }
  return values
}

export function duplicateData(data: EntryValues, fields: Field[], titleField?: string): EntryValues {
  const copy = { ...data }
  const key = resolveTitleField(fields, titleField)
  if (key && typeof copy[key] === 'string' && (copy[key] as string).trim()) copy[key] = `${copy[key]} (copy)`
  return copy
}
