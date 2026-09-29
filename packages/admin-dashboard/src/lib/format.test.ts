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

import { formatAbsolute, formatRelative } from './format'

describe('formatRelative', () => {
  const now = new Date('2026-09-29T12:00:00Z')
  it.each([
    ['2026-09-29T11:59:40Z', 'just now'],
    ['2026-09-29T11:15:00Z', '45m ago'],
    ['2026-09-29T09:00:00Z', '3h ago'],
    ['2026-09-28T09:00:00Z', 'yesterday'],
    ['2026-09-25T12:00:00Z', '4 days ago'],
    ['2026-08-01T12:00:00Z', '1 Aug 2026'],
  ])('%s is %s', (date, expected) => {
    expect(formatRelative(date, now)).toBe(expected)
  })
  it('treats future timestamps (clock skew) as just now', () => {
    expect(formatRelative('2026-09-29T12:05:00Z', now)).toBe('just now')
  })
  it('formats absolute dates', () => {
    expect(formatAbsolute(new Date(2026, 8, 29, 14, 5))).toBe('29 Sep 2026, 14:05')
  })
})
