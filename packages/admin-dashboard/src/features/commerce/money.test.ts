import { formatMoney, fromMinor, toMinor } from './money'

it('reads prices typed in English or Czech into minor units', () => {
  expect(toMinor('490', 2, 'en')).toBe(49000)
  expect(toMinor('490.5', 2, 'en')).toBe(49050)
  expect(toMinor('490,5', 2, 'cs')).toBe(49050)
  expect(toMinor('1 490,50', 2, 'cs')).toBe(149050)
  expect(toMinor('1,490.50', 2, 'en')).toBe(149050)
  expect(toMinor('15', 0, 'en')).toBe(15)
})

it('rejects text that is not a price for the currency', () => {
  for (const bad of ['abc', '', '-1', '1.234', '1.5.0']) expect(toMinor(bad, 2, 'en')).toBeNull()
  expect(toMinor('1.5', 0, 'en')).toBeNull()
})

it('shows minor units in the admin language', () => {
  expect(fromMinor(49050, 2, 'en')).toBe('490.50')
  expect(fromMinor(49050, 2, 'cs')).toBe('490,50')
  expect(formatMoney(149050, { code: 'CZK', decimals: 2 }, 'cs')).toMatch(/1\s490,50\sKč/)
  expect(formatMoney(2000, { code: 'EUR', decimals: 2 }, 'en')).toBe('€20.00')
})
