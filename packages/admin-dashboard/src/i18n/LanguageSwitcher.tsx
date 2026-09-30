import { useTranslation } from 'react-i18next'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, isLanguage } from './language'
import { useLanguage } from './useLanguage'

export function LanguageSwitcher() {
  const { t } = useTranslation('shell')
  const { language, setLanguage } = useLanguage()
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      {t('userMenu.language')}
      <select
        value={language}
        onChange={(e) => isLanguage(e.target.value) && setLanguage(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LANGUAGE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  )
}
