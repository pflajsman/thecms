import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api-error'
import { useLanguage } from '@/i18n/useLanguage'
import { EMAIL, type CreatedInvitation } from '../projects-api'
import { useProjectWrites } from '../projects-queries'
import { InviteLink } from './InviteLink'

export function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the form resets on every open. */}
      <DialogContent>
        <CreateForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('projects')
  const { language } = useLanguage()
  const writes = useProjectWrites()
  const [name, setName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState<CreatedInvitation | null>(null)
  const nameError = name.trim() === '' || name.trim().length > 100 ? t('renameForm.nameRequired') : undefined
  const emailError = !EMAIL.test(ownerEmail.trim()) ? t('inviteForm.emailInvalid') : undefined

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{t('inviteForm.sentTitle')}</DialogTitle>
        </DialogHeader>
        <InviteLink created={created} />
        <DialogFooter>
          <Button onClick={onDone}>{t('inviteForm.done')}</Button>
        </DialogFooter>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        if (nameError || emailError || pending) return
        setPending(true)
        writes
          .create({ name: name.trim(), ownerEmail: ownerEmail.trim(), language })
          .then((result) => {
            toast.success(t('toast.created', { name: result.project.name }))
            setCreated(result)
          })
          .catch((error: unknown) => toast.error(apiErrorMessage(error)))
          .finally(() => setPending(false))
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t('createForm.title')}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="new-project-name">{t('createForm.name')}</Label>
        <Input id="new-project-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && nameError ? true : undefined} />
        {submitted && nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-project-owner">{t('createForm.ownerEmail')}</Label>
        <Input
          id="new-project-owner"
          type="email"
          autoComplete="off"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          aria-invalid={submitted && emailError ? true : undefined}
          aria-describedby="new-project-owner-hint"
        />
        <p id="new-project-owner-hint" className={submitted && emailError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {submitted && emailError ? emailError : t('createForm.ownerHint')}
        </p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>{t('createForm.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
