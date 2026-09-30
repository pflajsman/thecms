import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { NAMESPACES, resources } from './resources'
import { detectLanguage } from './language'

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'cs'],
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  // Catalogs are bundled, so initialize synchronously: no flash of untranslated text.
  initAsync: false,
})

export { i18n }
