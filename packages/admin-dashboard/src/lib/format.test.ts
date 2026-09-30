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
import { i18n } from '@/i18n'
import { formatDate, formatNumber } from './format'

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

describe('in Czech', () => {
  const now = new Date('2026-09-29T12:00:00Z')
  beforeEach(async () => {
    await i18n.changeLanguage('cs')
  })

  it.each([
    ['2026-09-29T11:59:30Z', 'právě teď'],
    ['2026-09-29T11:15:00Z', 'před 45 min'],
    ['2026-09-29T09:00:00Z', 'před 3 h'],
    ['2026-09-28T12:00:00Z', 'včera'],
    ['2026-09-25T12:00:00Z', 'před 4 dny'],
    ['2026-08-01T12:00:00Z', '1. srpna 2026'],
  ])('%s is %s', (date, expected) => {
    expect(formatRelative(date, now)).toBe(expected)
  })

  it('formats absolute dates and days', () => {
    expect(formatAbsolute(new Date(2026, 8, 29, 14, 5))).toBe('29. 9. 2026, 14:05')
    expect(formatDate(new Date(2026, 7, 1))).toBe('1. srpna 2026')
  })

  it('formats numbers with Czech separators', () => {
    expect(formatNumber(1500.5).replace(/\s/g, ' ')).toBe('1 500,5')
  })
})

it('formats days and numbers in English', () => {
  expect(formatDate(new Date(2026, 7, 1))).toBe('1 Aug 2026')
  expect(formatNumber(1500.5)).toBe('1,500.5')
})
