import type { ContentType } from '@/types'
import { coverMediaId } from './cover'
import { makeListItem, tripType } from './test-fixtures'

const withCover: ContentType = {
  ...tripType,
  fields: [...tripType.fields, { name: 'gallery', label: 'Gallery', type: 'MEDIA', required: false, validation: { multiple: true } }, { name: 'cover', label: 'Cover', type: 'MEDIA', required: false }],
}

it('uses the first single media field', () => {
  expect(coverMediaId(makeListItem({ data: { title: 'x', gallery: ['g1'], cover: 'c1' } }), withCover)).toBe('c1')
  expect(coverMediaId(makeListItem({ data: { title: 'x' } }), withCover)).toBeUndefined()
  expect(coverMediaId(makeListItem(), undefined)).toBeUndefined()
})
