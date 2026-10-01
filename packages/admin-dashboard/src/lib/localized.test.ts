import { isLocalized } from './localized'

it('translates text and rich text by default and shares the rest', () => {
  expect(isLocalized({ type: 'TEXT' })).toBe(true)
  expect(isLocalized({ type: 'RICH_TEXT' })).toBe(true)
  for (const type of ['NUMBER', 'DATE', 'BOOLEAN', 'MEDIA', 'RELATION'] as const) expect(isLocalized({ type })).toBe(false)
  expect(isLocalized({ type: 'TEXT', localized: false })).toBe(false)
  expect(isLocalized({ type: 'MEDIA', localized: true })).toBe(true)
})
