import { useTranslation } from 'react-i18next'

/** Placeholder for Commerce pages until they land. */
export function ComingSoon() {
  const { t } = useTranslation('commerce')
  return <p className="text-muted-foreground">{t('comingSoon')}</p>
}
