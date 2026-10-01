import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { Language } from '@/features/languages/languages-api'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ChangeLanguageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Languages the item has no version in. */
  free: Language[]
  current: string
  /** True when the item has another version in the default language. */
  defaultCovered: boolean
  defaultLanguage?: Language
  pending: boolean
  onConfirm: (code: string) => void
}

export function ChangeLanguageDialog({ open, onOpenChange, ...rest }: ChangeLanguageDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <ChangeLanguageBody {...rest} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ChangeLanguageBody({ free, current, defaultCovered, defaultLanguage, pending, onConfirm }: Omit<ChangeLanguageDialogProps, 'open' | 'onOpenChange'>) {
  const { t } = useTranslation('editor')
  const [code, setCode] = useState<string>()
  const leavesDefault = !!defaultLanguage && current === defaultLanguage.code && !defaultCovered && !!code
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="font-serif text-xl">{t('languages.changeTitle')}</AlertDialogTitle>
        <AlertDialogDescription>{free.length ? t('languages.changeText') : t('languages.noFreeLanguage')}</AlertDialogDescription>
      </AlertDialogHeader>
      {free.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="change-language">{t('languages.changeSelect')}</Label>
          <Select value={code} onValueChange={setCode}>
            <SelectTrigger id="change-language" aria-label={t('languages.changeSelect')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {free.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {leavesDefault && (
        <p role="alert" className="rounded-md border border-status-draft-fg/40 bg-status-draft-bg px-3 py-2 text-sm text-status-draft-fg">
          {t('languages.noDefaultWarning', { language: defaultLanguage!.name })}
        </p>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel>{t('actions.cancel', { ns: 'common' })}</AlertDialogCancel>
        <Button disabled={!code || pending} onClick={() => code && onConfirm(code)}>{t('languages.changeConfirm')}</Button>
      </AlertDialogFooter>
    </>
  )
}
