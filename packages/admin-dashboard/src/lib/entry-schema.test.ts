import type { Field } from '@/types'
import {
  buildEntrySchema,
  createInitialValues,
  duplicateData,
  resolveTitleField,
  toEntryPayload,
  validateEntry,
} from './entry-schema'

const f = (over: Partial<Field> & Pick<Field, 'name' | 'type'>): Field => ({ label: over.name, required: false, ...over })

describe('resolveTitleField', () => {
  const fields = [f({ name: 'cover', type: 'MEDIA' }), f({ name: 'headline', type: 'TEXT' }), f({ name: 'summary', type: 'TEXT' })]
  it('uses titleField when it is a TEXT field, else the first TEXT field', () => {
    expect(resolveTitleField(fields, 'summary')).toBe('summary')
    expect(resolveTitleField(fields, 'cover')).toBe('headline')
    expect(resolveTitleField(fields)).toBe('headline')
    expect(resolveTitleField([f({ name: 'n', type: 'NUMBER' })])).toBeUndefined()
  })
})

describe('validateEntry: required', () => {
  it.each([
    ['TEXT', '   '],
    ['TEXT', undefined],
    ['RICH_TEXT', '<p></p>'],
    ['NUMBER', undefined],
    ['NUMBER', Number.NaN],
    ['DATE', ''],
    ['MEDIA', ''],
    ['RELATION', []],
  ] as const)('%s with %j is missing', (type, value) => {
    const fields = [f({ name: 'x', label: 'X', type, required: true, validation: type === 'RELATION' ? { multiple: true } : undefined })]
    expect(validateEntry(fields, { x: value })).toEqual({ x: 'X is required' })
  })

  it('treats false and 0 as provided', () => {
    const fields = [f({ name: 'b', type: 'BOOLEAN', required: true }), f({ name: 'n', type: 'NUMBER', required: true })]
    expect(validateEntry(fields, { b: false, n: 0 })).toEqual({})
  })

  it('ignores empty optional fields', () => {
    const fields = [f({ name: 'n', type: 'NUMBER', validation: { min: 5 } })]
    expect(validateEntry(fields, { n: undefined })).toEqual({})
  })
})

describe('validateEntry: rules', () => {
  it('checks text length and pattern', () => {
    const fields = [f({ name: 't', label: 'Slug', type: 'TEXT', validation: { minLength: 3, maxLength: 5, pattern: '^[a-z]+$' } })]
    expect(validateEntry(fields, { t: 'ab' })).toEqual({ t: 'Slug must be at least 3 characters' })
    expect(validateEntry(fields, { t: 'abcdef' })).toEqual({ t: 'Slug must be at most 5 characters' })
    expect(validateEntry(fields, { t: 'ABC' })).toEqual({ t: 'Slug does not match the required pattern' })
    expect(validateEntry(fields, { t: 'abc' })).toEqual({})
  })

  it('does not throw on an invalid pattern and skips the pattern check', () => {
    const fields = [f({ name: 't', type: 'TEXT', validation: { pattern: '([' } })]
    expect(() => validateEntry(fields, { t: 'anything' })).not.toThrow()
    expect(validateEntry(fields, { t: 'anything' })).toEqual({})
  })

  it('checks numbers', () => {
    const fields = [f({ name: 'km', label: 'Distance', type: 'NUMBER', validation: { min: 1, max: 500, integer: true } })]
    expect(validateEntry(fields, { km: 0 })).toEqual({ km: 'Distance must be at least 1' })
    expect(validateEntry(fields, { km: 501 })).toEqual({ km: 'Distance must be at most 500' })
    expect(validateEntry(fields, { km: 1.5 })).toEqual({ km: 'Distance must be a whole number' })
    expect(validateEntry(fields, { km: '12' })).toEqual({ km: 'Distance must be a number' })
  })

  it('checks dates', () => {
    const fields = [f({ name: 'd', label: 'Date', type: 'DATE', validation: { minDate: '2026-01-01T00:00:00.000Z' } })]
    expect(validateEntry(fields, { d: 'not a date' })).toEqual({ d: 'Date must be a valid date' })
    expect(validateEntry(fields, { d: '2025-06-01T00:00:00.000Z' })).toEqual({ d: 'Date must be on or after 1 Jan 2026' })
    expect(validateEntry(fields, { d: '2026-06-01T00:00:00.000Z' })).toEqual({})
  })

  it('checks rich text max length', () => {
    const fields = [f({ name: 'b', label: 'Body', type: 'RICH_TEXT', validation: { maxLength: 10 } })]
    expect(validateEntry(fields, { b: '<p>way too long</p>' })).toEqual({ b: 'Body must be at most 10 characters' })
  })

  it('checks single and multiple references', () => {
    const fields = [f({ name: 'one', label: 'One', type: 'MEDIA' }), f({ name: 'many', label: 'Many', type: 'RELATION', validation: { multiple: true } })]
    expect(validateEntry(fields, { one: ['a'], many: 'a' })).toEqual({ one: 'One must be a single item', many: 'Many must be a list' })
  })

  it('is exposed as a zod schema', () => {
    const schema = buildEntrySchema([f({ name: 't', label: 'Title', type: 'TEXT', required: true })])
    const result = schema.safeParse({ t: '' })
    expect(result.success).toBe(false)
  })
})

describe('toEntryPayload', () => {
  const fields = [
    f({ name: 'title', type: 'TEXT' }),
    f({ name: 'km', type: 'NUMBER' }),
    f({ name: 'cover', type: 'MEDIA' }),
    f({ name: 'tags', type: 'RELATION', validation: { multiple: true } }),
    f({ name: 'body', type: 'RICH_TEXT' }),
    f({ name: 'done', type: 'BOOLEAN' }),
  ]
  it('omits empty optional values so the backend never receives empty strings', () => {
    expect(toEntryPayload(fields, { title: 'Hi', km: undefined, cover: '', tags: [], body: '<p></p>', done: false }))
      .toEqual({ title: 'Hi', done: false })
  })
  it('keeps zero and data from fields no longer in the model', () => {
    expect(toEntryPayload(fields, { km: 0, legacyField: 'keep me' })).toEqual({ km: 0, legacyField: 'keep me' })
  })
})

describe('createInitialValues and duplicateData', () => {
  const fields = [f({ name: 'title', type: 'TEXT' }), f({ name: 'featured', type: 'BOOLEAN', defaultValue: true })]
  it('applies defaults only for new entries', () => {
    expect(createInitialValues(fields)).toEqual({ featured: true })
    expect(createInitialValues(fields, { title: 'A' })).toEqual({ title: 'A' })
  })
  it('suffixes the title of a copy', () => {
    expect(duplicateData({ title: 'Trip', featured: true }, fields)).toEqual({ title: 'Trip (copy)', featured: true })
    expect(duplicateData({ featured: true }, fields)).toEqual({ featured: true })
  })
})
