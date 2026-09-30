export const SUPPORTED_LANGUAGES = ['en', 'cs'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = 'thecms.language'

/** Each language named in itself, as shown in the switcher. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', cs: 'Čeština' }

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export function readLanguagePreference(): Language | null {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguage(value) ? value : null
  } catch {
    return null
  }
}

export function writeLanguagePreference(language: Language): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Storage unavailable (private mode, blocked site data): keep the choice for this session only.
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? navigator.languages : [navigator.language]
}

/** Saved choice, else Czech when the browser's preferred language is Czech, else English. */
export function detectLanguage(languages: readonly string[] = browserLanguages()): Language {
  const saved = readLanguagePreference()
  if (saved) return saved
  return (languages[0] ?? '').toLowerCase().startsWith('cs') ? 'cs' : 'en'
}
