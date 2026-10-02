import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Languages as LanguagesIcon, Plus, Sparkles } from 'lucide-react'
import type { EntryVersion } from '@/types'
import type { Language } from '@/features/languages/languages-api'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface LanguageMenuProps {
  languages: Language[]
  versions: EntryVersion[]
  current: string
  /** False while the editor has unsaved changes: a translation copies the saved version. */
  canTranslate: boolean
  busy: boolean
  onOpen: (id: string) => void
  onTranslate: (code: string) => void
  /** Present when AI is ready: offers an AI translation next to each copy. */
  onTranslateAi?: (code: string) => void
}

export function LanguageMenu({ languages, versions, current, canTranslate, busy, onOpen, onTranslate, onTranslateAi }: LanguageMenuProps) {
  const { t } = useTranslation('editor')
  const name = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  const byLanguage = new Map(versions.map((v) => [v.language, v]))
  const missing = languages.filter((l) => !byLanguage.has(l.code))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('languages.switcherLabel', { language: name(current) })}>
          <LanguagesIcon aria-hidden />
          <span className="font-mono text-xs uppercase">{current}</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {languages.filter((l) => byLanguage.has(l.code)).map((l) => {
          const version = byLanguage.get(l.code)!
          return (
            <DropdownMenuItem key={l.code} disabled={l.code === current} onSelect={() => onOpen(version.id)}>
              <span className="flex-1">{l.name}</span>
              <span className="text-xs text-muted-foreground">{t(`status.${version.status}`, { ns: 'common' })}</span>
            </DropdownMenuItem>
          )
        })}
        {missing.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {canTranslate ? t('languages.missing') : t('languages.saveFirst')}
            </DropdownMenuLabel>
            {missing.map((l) => (
              <Fragment key={l.code}>
                <DropdownMenuItem disabled={!canTranslate || busy} onSelect={() => onTranslate(l.code)}>
                  <Plus aria-hidden />
                  {t('languages.translateTo', { language: l.name })}
                </DropdownMenuItem>
                {onTranslateAi && (
                  <DropdownMenuItem disabled={!canTranslate || busy} onSelect={() => onTranslateAi(l.code)}>
                    <Sparkles aria-hidden />
                    {t('languages.translateWithAi', { language: l.name })}
                  </DropdownMenuItem>
                )}
              </Fragment>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
