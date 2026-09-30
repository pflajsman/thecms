import { z } from 'zod'
import { formatDate, formatNumber } from '@/lib/format'
import { i18n } from '@/i18n'
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

function fieldError(field: Field, value: unknown, lng?: string): string | null {
  const label = field.label || field.name
  const rules = field.validation ?? {}

  switch (field.type) {
    case 'TEXT': {
      if (typeof value !== 'string') return i18n.t('editor:validation.text', { lng, label })
      if (rules.minLength !== undefined && value.length < rules.minLength) return i18n.t('editor:validation.minLength', { lng, label, count: rules.minLength })
      if (rules.maxLength !== undefined && value.length > rules.maxLength) return i18n.t('editor:validation.maxLength', { lng, label, count: rules.maxLength })
      const re = rules.pattern ? safeRegExp(rules.pattern) : null
      if (re && !re.test(value)) return i18n.t('editor:validation.pattern', { lng, label })
      return null
    }
    case 'RICH_TEXT': {
      if (typeof value !== 'string') return i18n.t('editor:validation.text', { lng, label })
      if (rules.maxLength !== undefined && value.length > rules.maxLength) return i18n.t('editor:validation.maxLength', { lng, label, count: rules.maxLength })
      return null
    }
    case 'NUMBER': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return i18n.t('editor:validation.number', { lng, label })
      if (rules.integer && !Number.isInteger(value)) return i18n.t('editor:validation.integer', { lng, label })
      if (rules.min !== undefined && value < rules.min) return i18n.t('editor:validation.min', { lng, label, min: formatNumber(rules.min) })
      if (rules.max !== undefined && value > rules.max) return i18n.t('editor:validation.max', { lng, label, max: formatNumber(rules.max) })
      return null
    }
    case 'DATE': {
      const time = typeof value === 'string' ? new Date(value).getTime() : Number.NaN
      if (Number.isNaN(time)) return i18n.t('editor:validation.date', { lng, label })
      if (rules.minDate && time < new Date(rules.minDate).getTime()) return i18n.t('editor:validation.minDate', { lng, label, date: formatDate(rules.minDate) })
      if (rules.maxDate && time > new Date(rules.maxDate).getTime()) return i18n.t('editor:validation.maxDate', { lng, label, date: formatDate(rules.maxDate) })
      return null
    }
    case 'BOOLEAN':
      return typeof value === 'boolean' ? null : i18n.t('editor:validation.boolean', { lng, label })
    case 'MEDIA':
    case 'RELATION': {
      if (rules.multiple) {
        return Array.isArray(value) && value.every((v) => typeof v === 'string') ? null : i18n.t('editor:validation.list', { lng, label })
      }
      return typeof value === 'string' ? null : i18n.t('editor:validation.single', { lng, label })
    }
    default:
      return null
  }
}

/** Field name to its first error. Mirrors packages/backend/.../validation.helper.ts, plus: empty strings count as missing. */
/** `lng` builds the messages in that language (defaults to the current one). */
export function validateEntry(fields: Field[], values: EntryValues, lng?: string): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const value = values[field.name]
    if (isEmptyValue(field, value)) {
      if (field.required) errors[field.name] = i18n.t('editor:validation.required', { lng, label: field.label || field.name })
      continue
    }
    const error = fieldError(field, value, lng)
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
  if (key && typeof copy[key] === 'string' && (copy[key] as string).trim()) copy[key] = i18n.t('editor:copySuffix', { title: copy[key] as string })
  return copy
}
