import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { i18n } from './index'
import { isLanguage, writeLanguagePreference, type Language } from './language'
import { LanguageContext } from './language-context'

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Subscribes to languageChanged, so the whole tree re-renders on a switch.
  const { i18n: instance } = useTranslation()
  const language: Language = isLanguage(instance.resolvedLanguage) ? instance.resolvedLanguage : 'en'

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    writeLanguagePreference(next)
    void i18n.changeLanguage(next)
  }, [])

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
