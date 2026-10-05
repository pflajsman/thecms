import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiErrorMessage } from '@/lib/api-error'
import { useLanguage } from '@/i18n/useLanguage'
import { EMAIL, type CreatedInvitation, type ProjectRole } from '../projects-api'
import { useMemberWrites } from '../projects-queries'
import { grantableRoles } from '../project-roles'
import { InviteLink } from './InviteLink'

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The inviter's role: they can grant up to it. */
  actorRole: ProjectRole
}

export function InviteDialog({ open, onOpenChange, actorRole }: InviteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the form resets on every open. */}
      <DialogContent>
        <InviteForm actorRole={actorRole} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function InviteForm({ actorRole, onDone }: { actorRole: ProjectRole; onDone: () => void }) {
  const { t } = useTranslation('projects')
  const { language } = useLanguage()
  const writes = useMemberWrites()
  const roles = grantableRoles(actorRole)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectRole>(roles.includes('EDITOR') ? 'EDITOR' : roles[roles.length - 1])
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState<CreatedInvitation | null>(null)
  const emailError = !EMAIL.test(email.trim()) ? t('inviteForm.emailInvalid') : undefined

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
        if (emailError || pending) return
        setPending(true)
        writes
          .invite({ email: email.trim(), role, language })
          .then(setCreated)
          .catch((error: unknown) => toast.error(apiErrorMessage(error)))
          .finally(() => setPending(false))
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t('inviteForm.title')}</DialogTitle>
        <DialogDescription>{t('inviteForm.linkHint')}</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="invite-email">{t('inviteForm.email')}</Label>
        <Input id="invite-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={submitted && emailError ? true : undefined} />
        {submitted && emailError && <p className="text-sm text-destructive">{emailError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-role">{t('inviteForm.role')}</Label>
        <select id="invite-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value as ProjectRole)} aria-describedby="invite-role-hint">
          {roles.map((r) => (
            <option key={r} value={r}>{t(`roles.${r}`)}</option>
          ))}
        </select>
        <p id="invite-role-hint" className="text-sm text-muted-foreground">{t(`roleHints.${role}`)}</p>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>{t('inviteForm.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
