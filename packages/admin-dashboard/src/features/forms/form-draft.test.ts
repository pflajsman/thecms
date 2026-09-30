import type { ContactForm } from '@/types'
import { addFormField, draftFromForm, newFormDraft, setFormFieldLabel, setFormName, toFormPayload, updateFormField, validateForm } from './form-draft'
import { i18n } from '@/i18n'

describe('form drafts', () => {
  it('starts with name, email and message fields', () => {
    const d = setFormName(newFormDraft(), 'Contact us')
    expect(d.slug).toBe('contact-us')
    expect(d.fields.map((f) => [f.name, f.type, f.required])).toEqual([
      ['name', 'TEXT', true],
      ['email', 'EMAIL', true],
      ['message', 'TEXTAREA', true],
    ])
  })

  it('requires options for a select field and a valid recipient', () => {
    let d = setFormName(newFormDraft(), 'Booking')
    d = { ...d, recipientEmail: 'not-an-email' }
    const { draft, cid } = addFormField(d, 'SELECT')
    const errors = validateForm(draft)
    expect(errors.recipientEmail).toBe('Enter a valid email address')
    expect(errors[`options:${cid}`]).toBe('Add at least one option')
    const withOptions = updateFormField(draft, cid, { options: ['Morning', ' ', 'Evening'] })
    expect(validateForm(withOptions)[`options:${cid}`]).toBeUndefined()
  })

  it('builds the payload: trims options, omits empty site and validation', () => {
    let d = setFormName({ ...newFormDraft(), recipientEmail: 'me@x.test' }, 'Booking')
    const { draft, cid } = addFormField(d, 'SELECT')
    d = setFormFieldLabel(draft, cid, 'Time slot')
    d = updateFormField(d, cid, { options: [' Morning ', '', 'Evening'], validation: { minLength: undefined } })
    const payload = toFormPayload(d)
    expect(payload.siteId).toBeUndefined()
    expect(payload.fields.at(-1)).toEqual({ name: 'timeSlot', label: 'Time slot', type: 'SELECT', required: false, options: ['Morning', 'Evening'] })
    expect(payload.fields[0]).not.toHaveProperty('options')
  })

  it('keeps keys of saved fields when labels change', () => {
    const form: ContactForm = {
      id: 'f1', name: 'Contact', slug: 'contact', recipientEmail: 'me@x.test', isActive: true, submissionCount: 3, createdAt: '', updatedAt: '',
      fields: [{ name: 'msg', label: 'Message', type: 'TEXTAREA', required: true }],
    }
    const d = draftFromForm(form)
    expect(setFormFieldLabel(d, d.fields[0].cid, 'Your message').fields[0].name).toBe('msg')
  })
})

describe('form rule validation', () => {
  it('flags lengths the server rejects', () => {
    const base = setFormName({ ...newFormDraft(), recipientEmail: 'me@x.test' }, 'Booking')
    const { draft, cid } = addFormField(base, 'TEXT')
    expect(validateForm(updateFormField(draft, cid, { validation: { maxLength: 0 } }))[`rules:${cid}`]).toBe('Max length must be a whole number of at least 1')
    expect(validateForm(updateFormField(draft, cid, { validation: { minLength: -1 } }))[`rules:${cid}`]).toBe('Min length must be a whole number of 0 or more')
    expect(validateForm(updateFormField(draft, cid, { validation: { min: 5, max: 1 } }))[`rules:${cid}`]).toBe('Maximum must be at least the minimum')
  })
})

it('explains form errors in Czech', async () => {
  await i18n.changeLanguage('cs')
  const errors = validateForm({ ...newFormDraft(), name: '', recipientEmail: 'x' })
  expect(errors.name).toBe('Název je povinný')
  expect(errors.recipientEmail).toBe('Zadejte platnou e-mailovou adresu')
})
