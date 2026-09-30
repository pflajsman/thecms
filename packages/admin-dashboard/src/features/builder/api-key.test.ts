import { apiKeyError, toApiKey, toSlug, uniqueKey } from './api-key'
import { i18n } from '@/i18n'

describe('toApiKey', () => {
  it.each([
    ['GPX track', 'gpxTrack'],
    ['GPX URL', 'gpxUrl'],
    ['Distance (km)', 'distanceKm'],
    ['Přes Šumavu', 'presSumavu'],
    ['2nd line', 'field2ndLine'],
    ['   ', ''],
  ])('%j becomes %j', (label, key) => {
    expect(toApiKey(label)).toBe(key)
  })
  it('caps the length at 50', () => {
    expect(toApiKey('word '.repeat(30))).toHaveLength(50)
  })
})

describe('uniqueKey, toSlug, apiKeyError', () => {
  it('adds a number when taken', () => {
    expect(uniqueKey('title', ['title', 'title2'])).toBe('title3')
    expect(uniqueKey('body', ['title'])).toBe('body')
  })
  it('slugifies names', () => {
    expect(toSlug('Blog Post!')).toBe('blog-post')
    expect(toSlug('Přes Šumavu  2026')).toBe('pres-sumavu-2026')
  })
  it('reports invalid and duplicate keys', () => {
    expect(apiKeyError('', [])).toBe('API key is required')
    expect(apiKeyError('2nd', [])).toBe('Start with a letter; use only letters, numbers and underscores')
    expect(apiKeyError('title', ['title'])).toBe('Another field already uses this key')
    expect(apiKeyError('gpxurl', ['title'])).toBeNull()
  })
})

it('explains key problems in Czech', async () => {
  await i18n.changeLanguage('cs')
  expect(apiKeyError('1abc', [])).toBe('Začněte písmenem a používejte jen písmena, číslice a podtržítka')
  expect(apiKeyError('title', ['title'])).toBe('Tento klíč už používá jiné pole')
})
