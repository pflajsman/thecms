import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { EntryVersion } from '@/types'
import type { Language } from '@/features/languages/languages-api'
import { StatusPill } from '@/components/common/StatusPill'
import { Button } from '@/components/ui/button'

export function LanguagesSection({ languages, versions, current, onChange }: { languages: Language[]; versions: EntryVersion[]; current: string; onChange: () => void }) {
  const { t } = useTranslation('editor')
  const name = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  return (
    <section className="rounded-lg border bg-card p-3">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('languages.panelTitle')}</h2>
      <ul className="mb-3 flex flex-col gap-1.5 text-sm">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2">
            {v.language === current ? (
              <span className="font-medium">{name(v.language)}</span>
            ) : (
              <Link to={`/content/${v.id}`} className="hover:underline">{name(v.language)}</Link>
            )}
            <StatusPill status={v.status} />
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" onClick={onChange}>{t('languages.changeLanguage')}</Button>
    </section>
  )
}
