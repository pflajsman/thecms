import { displayFields, preview, replyAddress, senderName, viewStatus } from './inbox-utils'
import type { InboxItem } from './inbox-api'

const item = (over: Partial<InboxItem> = {}): InboxItem => ({
  id: 's1',
  formId: 'f1',
  data: { name: 'Jana Nováková', email: 'jana@x.test', message: 'Dotaz k trase přes Šumavu, je sjízdná na silničce?', extra: 'kept' },
  status: 'UNREAD',
  emailSent: true,
  createdAt: '2026-09-29T10:00:00Z',
  updatedAt: '2026-09-29T10:00:00Z',
  form: {
    id: 'f1', name: 'Contact', slug: 'contact',
    fields: [
      { name: 'name', label: 'Name', type: 'TEXT' },
      { name: 'email', label: 'Email', type: 'EMAIL' },
      { name: 'message', label: 'Message', type: 'TEXTAREA' },
    ],
  },
  ...over,
})

it('lists fields in form order with labels, then extra data', () => {
  expect(displayFields(item())).toEqual([
    { label: 'Name', value: 'Jana Nováková' },
    { label: 'Email', value: 'jana@x.test' },
    { label: 'Message', value: 'Dotaz k trase přes Šumavu, je sjízdná na silničce?' },
    { label: 'extra', value: 'kept' },
  ])
})

it('formats booleans and missing values', () => {
  const i = item({ data: { agree: true, empty: '' }, form: null })
  expect(displayFields(i)).toEqual([{ label: 'agree', value: 'Yes' }, { label: 'empty', value: '' }])
})

it('finds the sender and reply address', () => {
  expect(senderName(item())).toBe('Jana Nováková')
  expect(replyAddress(item())).toBe('jana@x.test')
  const noEmail = item({ data: { message: 'hi' }, form: { id: 'f', name: 'F', slug: 'f', fields: [{ name: 'message', label: 'Message', type: 'TEXTAREA' }] } })
  expect(replyAddress(noEmail)).toBeUndefined()
  expect(senderName(noEmail)).toBe('Anonymous')
})

it('previews the longest text value', () => {
  expect(preview(item())).toBe('Dotaz k trase přes Šumavu, je sjízdná na silničce?')
})

it('maps views to statuses', () => {
  expect([viewStatus('unread'), viewStatus('all'), viewStatus('archived')]).toEqual(['UNREAD', undefined, 'ARCHIVED'])
})
