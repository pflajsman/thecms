import type { ContentType, Field, FieldType, ValidationRules } from '@/types'
import { apiKeyError, toApiKey, toSlug, uniqueKey } from '@/features/builder/api-key'
import type { ModelTemplate } from './templates'
import type { ModelPayload } from './models-api'

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  TEXT: 'Text',
  RICH_TEXT: 'Rich text',
  NUMBER: 'Number',
  DATE: 'Date',
  BOOLEAN: 'Yes / No',
  MEDIA: 'Media',
  RELATION: 'Reference',
}

export type DraftField = Field & { cid: string; originalName?: string; keyTouched: boolean }

export interface ModelDraft {
  name: string
  slug: string
  slugTouched: boolean
  description: string
  titleCid?: string
  fields: DraftField[]
  /** Keys of the fields as last saved; used to detect removals. */
  originalNames: string[]
}

export type ModelErrors = Record<string, string>

let cidCounter = 0
const nextCid = () => `f${++cidCounter}`

export function emptyDraft(): ModelDraft {
  return { name: '', slug: '', slugTouched: false, description: '', fields: [], originalNames: [] }
}

export function draftFromType(ct: ContentType): ModelDraft {
  const fields = ct.fields.map((f) => ({ ...f, cid: nextCid(), originalName: f.name, keyTouched: true }))
  return {
    name: ct.name,
    slug: ct.slug,
    slugTouched: true,
    description: ct.description ?? '',
    titleCid: fields.find((f) => f.name === ct.titleField)?.cid,
    fields,
    originalNames: ct.fields.map((f) => f.name),
  }
}

export function draftFromTemplate(t: ModelTemplate): ModelDraft {
  const fields = t.fields.map((f) => ({ ...f, cid: nextCid(), keyTouched: true }))
  return {
    name: t.name,
    slug: toSlug(t.name),
    slugTouched: false,
    description: '',
    titleCid: fields.find((f) => f.name === t.titleField)?.cid,
    fields,
    originalNames: [],
  }
}

export function setModelName(d: ModelDraft, name: string): ModelDraft {
  return { ...d, name, slug: d.slugTouched ? d.slug : toSlug(name) }
}

export function setSlug(d: ModelDraft, slug: string): ModelDraft {
  return { ...d, slug, slugTouched: true }
}

const DEFAULT_LABELS: Record<FieldType, string> = {
  TEXT: 'Text',
  RICH_TEXT: 'Rich text',
  NUMBER: 'Number',
  DATE: 'Date',
  BOOLEAN: 'Yes or no',
  MEDIA: 'Media',
  RELATION: 'Reference',
}

export function addField(d: ModelDraft, type: FieldType): { draft: ModelDraft; cid: string } {
  const cid = nextCid()
  const label = DEFAULT_LABELS[type]
  const name = uniqueKey(toApiKey(label), d.fields.map((f) => f.name))
  const field: DraftField = { cid, name, label, type, required: false, keyTouched: false }
  const titleCid = d.titleCid ?? (type === 'TEXT' && !d.fields.some((f) => f.type === 'TEXT') ? cid : undefined)
  return { draft: { ...d, fields: [...d.fields, field], titleCid }, cid }
}

function mapField(d: ModelDraft, cid: string, fn: (f: DraftField) => DraftField): ModelDraft {
  return { ...d, fields: d.fields.map((f) => (f.cid === cid ? fn(f) : f)) }
}

export function updateField(d: ModelDraft, cid: string, patch: Partial<Field>): ModelDraft {
  return mapField(d, cid, (f) => ({ ...f, ...patch }))
}

export function setFieldLabel(d: ModelDraft, cid: string, label: string): ModelDraft {
  const others = d.fields.filter((f) => f.cid !== cid).map((f) => f.name)
  return mapField(d, cid, (f) => {
    // Saved fields and hand-edited keys keep their key: renaming them breaks sites.
    if (f.keyTouched || f.originalName) return { ...f, label }
    return { ...f, label, name: uniqueKey(toApiKey(label) || 'field', others) }
  })
}

export function setFieldKey(d: ModelDraft, cid: string, name: string): ModelDraft {
  return mapField(d, cid, (f) => ({ ...f, name: name.trim(), keyTouched: true }))
}

export function removeField(d: ModelDraft, cid: string): ModelDraft {
  return { ...d, fields: d.fields.filter((f) => f.cid !== cid), titleCid: d.titleCid === cid ? undefined : d.titleCid }
}

export function reorderFields(d: ModelDraft, cids: string[]): ModelDraft {
  const byCid = new Map(d.fields.map((f) => [f.cid, f]))
  return { ...d, fields: cids.map((c) => byCid.get(c)!).filter(Boolean) }
}

export function setTitleField(d: ModelDraft, cid: string): ModelDraft {
  return { ...d, titleCid: cid }
}

export function validateModel(d: ModelDraft): ModelErrors {
  const errors: ModelErrors = {}
  const name = d.name.trim()
  if (name.length < 2) errors.name = 'Name must be at least 2 characters'
  else if (name.length > 100) errors.name = 'Name must be at most 100 characters'
  if (!/^[a-z0-9-]{2,100}$/.test(d.slug)) errors.slug = 'Use lowercase letters, numbers and hyphens'
  if (d.fields.length === 0) errors.fields = 'Add at least one field'
  for (const f of d.fields) {
    if (!f.label.trim()) errors[`label:${f.cid}`] = 'Label is required'
    else if (f.label.trim().length > 100) errors[`label:${f.cid}`] = 'Label must be at most 100 characters'
    const others = d.fields.filter((o) => o.cid !== f.cid).map((o) => o.name)
    const keyError = apiKeyError(f.name, others)
    if (keyError) errors[`key:${f.cid}`] = keyError
    const ruleError = fieldRuleError(f)
    if (ruleError) errors[`rules:${f.cid}`] = ruleError
  }
  return errors
}

const isCount = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1

/** Mirrors the backend field schema so saving never fails with a vague server error. */
function fieldRuleError(f: DraftField): string | null {
  const v = f.validation ?? {}
  if (v.minLength !== undefined && !isCount(v.minLength)) return 'Min length must be a whole number of at least 1'
  if (v.maxLength !== undefined && !isCount(v.maxLength)) return 'Max length must be a whole number of at least 1'
  if (v.minLength !== undefined && v.maxLength !== undefined && v.maxLength < v.minLength) return 'Max length must be at least the min length'
  if (v.min !== undefined && v.max !== undefined && v.max < v.min) return 'Maximum must be at least the minimum'
  if ((f.description ?? '').trim().length > 500) return 'Help text must be at most 500 characters'
  return null
}

function cleanValidation(v?: ValidationRules): ValidationRules | undefined {
  if (!v) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, value] of Object.entries(v)) {
    if (value === undefined || value === null || value === '' || (typeof value === 'number' && Number.isNaN(value))) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (value === false) continue
    out[k] = value
  }
  return Object.keys(out).length ? (out as ValidationRules) : undefined
}

export function toModelPayload(d: ModelDraft): ModelPayload {
  const titleField = d.fields.find((f) => f.cid === d.titleCid && f.type === 'TEXT')?.name
  return {
    name: d.name.trim(),
    slug: d.slug,
    description: d.description.trim(),
    ...(titleField ? { titleField } : {}),
    fields: d.fields.map((f) => {
      const field: Field = { name: f.name, label: f.label.trim(), type: f.type, required: !!f.required }
      if (f.description?.trim()) field.description = f.description.trim()
      if (f.defaultValue !== undefined) field.defaultValue = f.defaultValue
      const clean = cleanValidation(f.validation)
      if (clean) field.validation = clean
      return field
    }),
  }
}

export function diffKeys(d: ModelDraft): { renamed: { from: string; to: string }[]; removed: string[] } {
  const renamed = d.fields.filter((f) => f.originalName && f.originalName !== f.name).map((f) => ({ from: f.originalName!, to: f.name }))
  const kept = new Set(d.fields.map((f) => f.originalName).filter(Boolean))
  const removed = d.originalNames.filter((n) => !kept.has(n))
  return { renamed, removed }
}
