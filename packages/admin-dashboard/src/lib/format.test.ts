import { getInitials } from './format'

describe('getInitials', () => {
  it('uses first and last word', () => {
    expect(getInitials('Pavel Flajsman')).toBe('PF')
    expect(getInitials('Ana María de la Cruz')).toBe('AC')
  })
  it('handles single names, extra spaces and empty input', () => {
    expect(getInitials('  jana ')).toBe('J')
    expect(getInitials('')).toBe('?')
    expect(getInitials(undefined)).toBe('?')
  })
})
