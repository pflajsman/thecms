import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LANGUAGE_CODE, type Language } from '../languages-api'

interface LanguageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Rename this language; absent means add a new one. */
  language?: Language
  pending: boolean
  onSubmit: (values: { code: string; name: string }) => void
}

export function LanguageFormDialog({ open, onOpenChange, ...rest }: LanguageFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the form resets on every open. */}
      <DialogContent>
        <LanguageForm {...rest} />
      </DialogContent>
    </Dialog>
  )
}

function LanguageForm({ language, pending, onSubmit }: Omit<LanguageFormDialogProps, 'open' | 'onOpenChange'>) {
  const { t } = useTranslation('languages')
  const [code, setCode] = useState(language?.code ?? '')
  const [name, setName] = useState(language?.name ?? '')
  const [submitted, setSubmitted] = useState(false)
  const cleanCode = code.trim().toLowerCase()
  const codeError = !language && !LANGUAGE_CODE.test(cleanCode) ? t('form.codeInvalid') : undefined
  const nameError = name.trim() === '' || name.trim().length > 50 ? t('form.nameRequired') : undefined
  const title = language ? t('form.renameTitle', { name: language.name }) : t('form.addTitle')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        if (codeError || nameError) return
        onSubmit({ code: language?.code ?? cleanCode, name: name.trim() })
      }}
      className="flex flex-col gap-4"
    >
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{title}</DialogTitle>
      </DialogHeader>
      {!language && (
        <div className="space-y-1.5">
          <Label htmlFor="language-code">{t('form.code')}</Label>
          <Input id="language-code" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" aria-invalid={submitted && codeError ? true : undefined} aria-describedby="language-code-help" />
          <p id="language-code-help" className={submitted && codeError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {submitted && codeError ? codeError : t('form.codeHint')}
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="language-name">{t('form.name')}</Label>
        <Input id="language-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && nameError ? true : undefined} />
        {submitted && nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>{language ? t('form.save') : t('form.add')}</Button>
      </DialogFooter>
    </form>
  )
}
