import type { ContactForm, FormFieldDefinition, FormFieldType } from '@/types'
import { apiKeyError, toApiKey, toSlug, uniqueKey } from '@/features/builder/api-key'
import type { FormPayload } from './forms-api'

export const FORM_FIELD_LABELS: Record<FormFieldType, string> = {
  TEXT: 'Short text',
  EMAIL: 'Email',
  TEXTAREA: 'Long text',
  SELECT: 'Choice',
  NUMBER: 'Number',
  CHECKBOX: 'Checkbox',
  DATE: 'Date',
}

export type DraftFormField = FormFieldDefinition & { cid: string; keyTouched: boolean; saved?: boolean }

export interface FormDraft {
  name: string
  slug: string
  slugTouched: boolean
  description: string
  recipientEmail: string
  siteId?: string
  isActive: boolean
  fields: DraftFormField[]
}

let counter = 0
const nextCid = () => `ff${++counter}`
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function newFormDraft(): FormDraft {
  return {
    name: '',
    slug: '',
    slugTouched: false,
    description: '',
    recipientEmail: '',
    isActive: true,
    fields: [
      { cid: nextCid(), keyTouched: true, name: 'name', label: 'Name', type: 'TEXT', required: true },
      { cid: nextCid(), keyTouched: true, name: 'email', label: 'Email', type: 'EMAIL', required: true },
      { cid: nextCid(), keyTouched: true, name: 'message', label: 'Message', type: 'TEXTAREA', required: true },
    ],
  }
}

export function draftFromForm(form: ContactForm): FormDraft {
  return {
    name: form.name,
    slug: form.slug,
    slugTouched: true,
    description: form.description ?? '',
    recipientEmail: form.recipientEmail,
    siteId: form.siteId || undefined,
    isActive: form.isActive,
    fields: form.fields.map((f) => ({ ...f, cid: nextCid(), keyTouched: true, saved: true })),
  }
}

export function setFormName(d: FormDraft, name: string): FormDraft {
  return { ...d, name, slug: d.slugTouched ? d.slug : toSlug(name) }
}

export function setFormSlug(d: FormDraft, slug: string): FormDraft {
  return { ...d, slug, slugTouched: true }
}

export function addFormField(d: FormDraft, type: FormFieldType): { draft: FormDraft; cid: string } {
  const cid = nextCid()
  const label = FORM_FIELD_LABELS[type]
  const field: DraftFormField = { cid, keyTouched: false, name: uniqueKey(toApiKey(label), d.fields.map((f) => f.name)), label, type, required: false, ...(type === 'SELECT' ? { options: [] } : {}) }
  return { draft: { ...d, fields: [...d.fields, field] }, cid }
}

function mapField(d: FormDraft, cid: string, fn: (f: DraftFormField) => DraftFormField): FormDraft {
  return { ...d, fields: d.fields.map((f) => (f.cid === cid ? fn(f) : f)) }
}

export function updateFormField(d: FormDraft, cid: string, patch: Partial<FormFieldDefinition>): FormDraft {
  return mapField(d, cid, (f) => ({ ...f, ...patch }))
}

export function setFormFieldLabel(d: FormDraft, cid: string, label: string): FormDraft {
  const others = d.fields.filter((f) => f.cid !== cid).map((f) => f.name)
  return mapField(d, cid, (f) => (f.keyTouched || f.saved ? { ...f, label } : { ...f, label, name: uniqueKey(toApiKey(label) || 'field', others) }))
}

export function setFormFieldKey(d: FormDraft, cid: string, name: string): FormDraft {
  return mapField(d, cid, (f) => ({ ...f, name: name.trim(), keyTouched: true }))
}

export function removeFormField(d: FormDraft, cid: string): FormDraft {
  return { ...d, fields: d.fields.filter((f) => f.cid !== cid) }
}

export function reorderFormFields(d: FormDraft, cids: string[]): FormDraft {
  const byCid = new Map(d.fields.map((f) => [f.cid, f]))
  return { ...d, fields: cids.map((c) => byCid.get(c)!).filter(Boolean) }
}

export function validateForm(d: FormDraft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!d.name.trim()) errors.name = 'Name is required'
  if (!/^[a-z0-9-]{1,100}$/.test(d.slug)) errors.slug = 'Use lowercase letters, numbers and hyphens'
  if (!EMAIL.test(d.recipientEmail.trim())) errors.recipientEmail = 'Enter a valid email address'
  if (d.fields.length === 0) errors.fields = 'Add at least one field'
  for (const f of d.fields) {
    if (!f.label.trim()) errors[`label:${f.cid}`] = 'Label is required'
    const keyError = apiKeyError(f.name, d.fields.filter((o) => o.cid !== f.cid).map((o) => o.name))
    if (keyError) errors[`key:${f.cid}`] = keyError
    if (f.type === 'SELECT' && !(f.options ?? []).some((o) => o.trim())) errors[`options:${f.cid}`] = 'Add at least one option'
  }
  return errors
}

export function toFormPayload(d: FormDraft): FormPayload {
  return {
    name: d.name.trim(),
    slug: d.slug,
    description: d.description.trim(),
    recipientEmail: d.recipientEmail.trim(),
    isActive: d.isActive,
    ...(d.siteId ? { siteId: d.siteId } : {}),
    fields: d.fields.map((f) => {
      const validation = Object.fromEntries(Object.entries(f.validation ?? {}).filter(([, v]) => v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))))
      const options = f.type === 'SELECT' ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined
      return {
        name: f.name,
        label: f.label.trim(),
        type: f.type,
        required: !!f.required,
        ...(f.placeholder?.trim() ? { placeholder: f.placeholder.trim() } : {}),
        ...(options ? { options } : {}),
        ...(Object.keys(validation).length ? { validation } : {}),
      }
    }),
  }
}
