import type { ContentType } from '@/types'
import {
  addField,
  diffKeys,
  draftFromTemplate,
  draftFromType,
  emptyDraft,
  removeField,
  reorderFields,
  setFieldKey,
  setFieldLabel,
  setModelName,
  setSlug,
  setTitleField,
  toModelPayload,
  updateField,
  validateModel,
} from './model-draft'
import { MODEL_TEMPLATES } from './templates'

const trip: ContentType = {
  id: 't1',
  name: 'Trip',
  slug: 'trip',
  titleField: 'title',
  fields: [
    { name: 'title', label: 'Title', type: 'TEXT', required: true },
    { name: 'gpxurl', label: 'GPX track', type: 'MEDIA', required: false },
  ],
  createdAt: '',
  updatedAt: '',
}

describe('model name and slug', () => {
  it('derives the slug from the name until the slug is edited', () => {
    let d = setModelName(emptyDraft(), 'Blog Post')
    expect(d.slug).toBe('blog-post')
    d = setSlug(d, 'posts')
    d = setModelName(d, 'Blog Posts')
    expect(d.slug).toBe('posts')
  })
})

describe('fields', () => {
  it('new fields get a camelCase key from the label, unique in the model', () => {
    const first = addField(emptyDraft(), 'TEXT')
    const cid = first.cid
    let draft = first.draft
    draft = setFieldLabel(draft, cid, 'GPX URL')
    expect(draft.fields[0].name).toBe('gpxUrl')
    const second = addField(draft, 'TEXT')
    const d2 = setFieldLabel(second.draft, second.cid, 'GPX url')
    expect(d2.fields[1].name).toBe('gpxUrl2')
  })

  it('never renames the key of a saved field or a hand-edited key when the label changes', () => {
    let d = draftFromType(trip)
    const cid = d.fields[1].cid
    d = setFieldLabel(d, cid, 'GPX file')
    expect(d.fields[1].name).toBe('gpxurl')
    const added = addField(d, 'NUMBER')
    d = setFieldKey(added.draft, added.cid, 'km')
    d = setFieldLabel(d, added.cid, 'Distance')
    expect(d.fields[2].name).toBe('km')
  })

  it('reorders, removes and moves the title', () => {
    let d = draftFromType(trip)
    const [a, b] = d.fields.map((f) => f.cid)
    d = reorderFields(d, [b, a])
    expect(d.fields.map((f) => f.name)).toEqual(['gpxurl', 'title'])
    d = removeField(d, a)
    expect(d.fields.map((f) => f.name)).toEqual(['gpxurl'])
    expect(d.titleCid).toBeUndefined()
  })
})

describe('validateModel', () => {
  it('requires a name, a valid slug and at least one field', () => {
    const errors = validateModel({ ...emptyDraft(), slug: 'Bad Slug' })
    expect(errors).toMatchObject({ name: 'Name must be at least 2 characters', slug: 'Use lowercase letters, numbers and hyphens', fields: 'Add at least one field' })
  })

  it('flags missing labels and duplicate or invalid keys on the field', () => {
    let d = setModelName(emptyDraft(), 'Trip')
    const a = addField(d, 'TEXT')
    d = setFieldLabel(a.draft, a.cid, 'Title')
    const b = addField(d, 'TEXT')
    d = setFieldKey(b.draft, b.cid, 'title')
    d = setFieldLabel(d, b.cid, '')
    const c = addField(d, 'TEXT')
    d = setFieldKey(c.draft, c.cid, '2nd')
    const errors = validateModel(d)
    expect(errors[`key:${b.cid}`]).toBe('Another field already uses this key')
    expect(errors[`label:${b.cid}`]).toBe('Label is required')
    expect(errors[`key:${c.cid}`]).toBe('Start with a letter; use only letters, numbers and underscores')
    expect(errors[`key:${a.cid}`]).toBe('Another field already uses this key')
  })
})

describe('payload and diff', () => {
  it('builds the API payload with the title field name and clean validation', () => {
    let d = draftFromType(trip)
    d = updateField(d, d.fields[0].cid, { validation: { maxLength: 150, minLength: undefined, pattern: '' } })
    const payload = toModelPayload(d)
    expect(payload).toEqual({
      name: 'Trip',
      slug: 'trip',
      description: '',
      titleField: 'title',
      fields: [
        { name: 'title', label: 'Title', type: 'TEXT', required: true, validation: { maxLength: 150 } },
        { name: 'gpxurl', label: 'GPX track', type: 'MEDIA', required: false },
      ],
    })
  })

  it('only sends a TEXT titleField', () => {
    let d = draftFromType(trip)
    d = setTitleField(d, d.fields[1].cid)
    expect(toModelPayload(d).titleField).toBeUndefined()
  })

  it('reports renamed and removed keys of saved fields', () => {
    let d = draftFromType(trip)
    d = setFieldKey(d, d.fields[1].cid, 'gpxUrl')
    const added = addField(d, 'TEXT')
    d = setFieldLabel(added.draft, added.cid, 'Summary')
    expect(diffKeys(d)).toEqual({ renamed: [{ from: 'gpxurl', to: 'gpxUrl' }], removed: [] })
    d = removeField(d, d.fields[0].cid)
    expect(diffKeys(d).removed).toEqual(['title'])
  })
})

describe('templates', () => {
  it('each template is a valid model with its title field', () => {
    for (const t of MODEL_TEMPLATES) {
      const d = draftFromTemplate(t)
      expect(validateModel(d)).toEqual({})
      expect(toModelPayload(d).titleField).toBe(t.titleField)
      expect(diffKeys(d)).toEqual({ renamed: [], removed: [] })
    }
  })
})

describe('rule validation', () => {
  it('flags values the server rejects', () => {
    let d = setModelName(emptyDraft(), 'Trip')
    const a = addField(d, 'TEXT')
    d = updateField(a.draft, a.cid, { validation: { minLength: 0 } })
    expect(validateModel(d)[`rules:${a.cid}`]).toBe('Min length must be a whole number of at least 1')
    d = updateField(d, a.cid, { validation: { minLength: 10, maxLength: 5 } })
    expect(validateModel(d)[`rules:${a.cid}`]).toBe('Max length must be at least the min length')
    d = updateField(d, a.cid, { validation: { minLength: 1.5 } })
    expect(validateModel(d)[`rules:${a.cid}`]).toBe('Min length must be a whole number of at least 1')
    d = updateField(d, a.cid, { validation: {}, label: 'x'.repeat(101) })
    expect(validateModel(d)[`label:${a.cid}`]).toBe('Label must be at most 100 characters')
    d = updateField(d, a.cid, { label: 'Ok', description: 'x'.repeat(501) })
    expect(validateModel(d)[`rules:${a.cid}`]).toBe('Help text must be at most 500 characters')
  })
})
