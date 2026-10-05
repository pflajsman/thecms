import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreatedInvitation } from '../projects-api'

/** The link of a new invitation, with whether the email went out. */
export function InviteLink({ created }: { created: CreatedInvitation }) {
  const { t } = useTranslation('projects')
  const copy = () => void navigator.clipboard?.writeText(created.inviteUrl).then(() => toast.success(t('toast.copied')))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {created.emailSent
          ? t('inviteForm.emailSent', { email: created.invitation.email })
          : t('inviteForm.emailNotSent', { email: created.invitation.email })}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="invite-link">{t('inviteForm.link')}</Label>
        <div className="flex gap-2">
          <Input id="invite-link" readOnly value={created.inviteUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={t('members.copyLink')}>
            <Copy aria-hidden />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('inviteForm.linkHint')}</p>
      </div>
    </div>
  )
}
