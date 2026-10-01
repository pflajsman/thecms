import { countryName, parseCountries } from './countries'

it('reads codes separated by commas or spaces, uppercased and without repeats', () => {
  expect(parseCountries('cz, sk at;cz')).toEqual({ codes: ['CZ', 'SK', 'AT'], invalid: [] })
  expect(parseCountries('CZ, XYZ, 1')).toEqual({ codes: ['CZ'], invalid: ['XYZ', '1'] })
})

it('names countries in the admin language', () => {
  expect(countryName('CZ', 'en')).toBe('Czechia')
  expect(countryName('CZ', 'cs')).toBe('Česko')
})
