import { LANGUAGE_STORAGE_KEY, detectLanguage, readLanguagePreference, writeLanguagePreference } from './language'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

it('uses a saved supported language first', () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'cs')
  expect(detectLanguage(['en-US'])).toBe('cs')
})

it('falls back to the browser preference when nothing valid is saved', () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de')
  expect(readLanguagePreference()).toBeNull()
  expect(detectLanguage(['cs-CZ', 'en'])).toBe('cs')
  expect(detectLanguage(['CS'])).toBe('cs')
  expect(detectLanguage(['en-GB', 'cs'])).toBe('en')
  expect(detectLanguage([])).toBe('en')
})

it('keeps working when storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(readLanguagePreference()).toBeNull()
  expect(() => writeLanguagePreference('cs')).not.toThrow()
  expect(detectLanguage(['cs'])).toBe('cs')
})
