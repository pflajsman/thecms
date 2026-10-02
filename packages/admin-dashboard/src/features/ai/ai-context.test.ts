import { aiContextFields } from './ai-context'
import type { Field } from '@/types'

const fields: Field[] = [
  { name: 'title', label: 'Title', type: 'TEXT', required: true },
  { name: 'body', label: 'Body', type: 'RICH_TEXT', required: false },
  { name: 'km', label: 'Km', type: 'NUMBER', required: false },
]

it('sends the other text fields as plain text, cut to 2,000 characters each', () => {
  const values = { title: 'Šumava', body: `<p>${'a'.repeat(30_000)}</p>`, km: 12 }
  const context = aiContextFields(fields, values, 'title')
  expect(context).toEqual([{ label: 'Body', value: 'a'.repeat(2000) + '…' }])
  expect(aiContextFields(fields, { title: '', body: '' }, 'title')).toEqual([])
})
