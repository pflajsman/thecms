import { combinations, removedByOptions } from './variant-plan'

const size = { key: 'size', labels: { en: 'Size' }, values: [{ key: 's', labels: { en: 'S' } }, { key: 'm', labels: { en: 'M' } }] }
const v = (id: string, optionValues: Record<string, string>) => ({ id, sku: id.toUpperCase(), optionValues, prices: {}, weightGrams: 0, stock: { tracked: false, quantity: 0 }, active: true })

it('lists every combination', () => {
  const color = { key: 'color', labels: { en: 'Colour' }, values: [{ key: 'red', labels: { en: 'Red' } }] }
  expect(combinations([size, color])).toEqual([{ size: 's', color: 'red' }, { size: 'm', color: 'red' }])
  expect(combinations([])).toEqual([{}])
})

it('finds variants an option change removes, like the server', () => {
  expect(removedByOptions([v('base', {})], [size]).map((x) => x.id)).toEqual([])
  const onlyS = [{ ...size, values: [size.values[0]] }]
  expect(removedByOptions([v('s', { size: 's' }), v('m', { size: 'm' })], onlyS).map((x) => x.id)).toEqual(['m'])
  expect(removedByOptions([v('s', { size: 's' }), v('s2', { size: 's' })], [size]).map((x) => x.id)).toEqual(['s2'])
})
