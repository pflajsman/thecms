import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { MoreHorizontal, Pencil, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { apiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import { useLanguage } from '@/i18n/useLanguage'
import type { Invitation, Member, ProjectRole } from '../projects-api'
import { useMembers, useMemberWrites, useProjectWrites } from '../projects-queries'
import { canManageMember, grantableRoles } from '../project-roles'
import { useProject } from '../ProjectContext'
import { InviteDialog } from '../components/InviteDialog'
import { RenameProjectDialog } from '../components/RenameProjectDialog'

const selectClass = 'h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Dialog =
  | { kind: 'invite' }
  | { kind: 'rename' }
  | { kind: 'remove'; member: Member }
  | { kind: 'leave' }
  | { kind: 'revoke'; invitation: Invitation }
  | null

const nameOf = (m: Member) => m.displayName || m.email || m.userId

export function MembersPage() {
  const { t } = useTranslation('projects')
  const { language } = useLanguage()
  const { me, project, role, can } = useProject()
  const members = useMembers()
  const writes = useMemberWrites()
  const projectWrites = useProjectWrites()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pending, setPending] = useState(false)

  const run = async (work: () => Promise<string | undefined>) => {
    setPending(true)
    try {
      const message = await work()
      if (message) toast.success(message)
      setDialog(null)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  const changeRole = (member: Member, next: ProjectRole) =>
    void run(async () => {
      await writes.changeRole(member.userId, next)
      return t('toast.roleChanged', { name: nameOf(member), role: t(`roles.${next}`) })
    })

  const canRename = can('manageProject')
  const canInvite = can('manageMembers')
  const copyLink = (url: string) => void navigator.clipboard?.writeText(url).then(() => toast.success(t('toast.copied')))

  const actions = (
    <div className="flex flex-wrap gap-2">
      {canRename && (
        <Button variant="outline" onClick={() => setDialog({ kind: 'rename' })}>
          <Pencil aria-hidden />
          {t('members.rename')}
        </Button>
      )}
      {canInvite && (
        <Button onClick={() => setDialog({ kind: 'invite' })}>
          <UserPlus aria-hidden />
          {t('members.invite')}
        </Button>
      )}
    </div>
  )

  let body: React.ReactNode
  if (members.isPending) body = <Skeleton className="h-40 w-full" />
  else if (members.isError) body = <ErrorState message={t('members.loadError')} onRetry={() => void members.refetch()} />
  else {
    const { members: list, invitations } = members.data
    body = (
      <div className="flex flex-col gap-8">
        <ul aria-label={t('members.tableLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
          {list.map((m) => {
            const self = m.userId === me.entraId
            const manageable = canManageMember(role, m.role)
            const roles = grantableRoles(role)
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {nameOf(m)}
                    {self && <Badge variant="secondary" className="ml-2">{t('members.you')}</Badge>}
                  </div>
                  {m.displayName && m.email && <div className="truncate text-sm text-muted-foreground">{m.email}</div>}
                </div>
                {manageable ? (
                  <select
                    aria-label={t('members.roleFor', { name: nameOf(m) })}
                    className={selectClass}
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => changeRole(m, e.target.value as ProjectRole)}
                  >
                    {(roles.includes(m.role) ? roles : [m.role, ...roles]).map((r) => (
                      <option key={r} value={r}>{t(`roles.${r}`)}</option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="outline">{t(`roles.${m.role}`)}</Badge>
                )}
                {self ? (
                  <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: 'leave' })}>{t('members.leave')}</Button>
                ) : (
                  manageable && (
                    <Button variant="ghost" size="sm" aria-label={t('members.removeLabel', { name: nameOf(m) })} onClick={() => setDialog({ kind: 'remove', member: m })}>
                      {t('members.remove')}
                    </Button>
                  )
                )}
              </li>
            )
          })}
        </ul>
        {invitations.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-serif text-lg font-semibold">{t('members.invitations')}</h2>
            <ul aria-label={t('members.invitationsLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
              {invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{i.email}</div>
                    <div className="text-sm text-muted-foreground">
                      {i.expired ? t('members.expired') : t('members.expires', { date: formatDate(i.expiresAt) })}
                    </div>
                  </div>
                  <Badge variant="outline">{t(`roles.${i.role}`)}</Badge>
                  {canManageMember(role, i.role) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t('members.actionsFor', { name: i.email })}>
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            void run(async () => {
                              const sent = await writes.resend(i.id, language)
                              if (!sent.emailSent) copyLink(sent.inviteUrl)
                              return sent.emailSent ? t('toast.resent', { email: i.email }) : t('toast.resentNoEmail', { email: i.email })
                            })
                          }
                        >
                          {t('members.resend')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog({ kind: 'revoke', invitation: i })}>
                          {t('members.revoke')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader title={t('members.title')} description={t('members.description', { project: project.name })} actions={actions} />
      {body}
      <InviteDialog open={dialog?.kind === 'invite'} onOpenChange={(o) => !o && setDialog(null)} actorRole={role} />
      <RenameProjectDialog
        open={dialog?.kind === 'rename'}
        onOpenChange={(o) => !o && setDialog(null)}
        name={project.name}
        pending={pending}
        onSubmit={(name) =>
          void run(async () => {
            await projectWrites.renameCurrent(name)
            return t('toast.renamed')
          })
        }
      />
      {dialog?.kind === 'remove' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={t('confirm.removeTitle', { name: nameOf(dialog.member) })}
          description={t('confirm.removeText', { name: nameOf(dialog.member), project: project.name })}
          confirmLabel={t('confirm.removeConfirm')}
          destructive
          pending={pending}
          onConfirm={() =>
            void run(async () => {
              await writes.remove(dialog.member.userId)
              return t('toast.removed', { name: nameOf(dialog.member) })
            })
          }
        />
      )}
      {dialog?.kind === 'leave' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={t('confirm.leaveTitle', { project: project.name })}
          description={t('confirm.leaveText')}
          confirmLabel={t('confirm.leaveConfirm')}
          destructive
          pending={pending}
          onConfirm={() =>
            void run(async () => {
              const name = project.name
              await writes.leave(me.entraId)
              return t('toast.left', { project: name })
            })
          }
        />
      )}
      {dialog?.kind === 'revoke' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={t('confirm.revokeTitle', { email: dialog.invitation.email })}
          description={t('confirm.revokeText')}
          confirmLabel={t('confirm.revokeConfirm')}
          destructive
          pending={pending}
          onConfirm={() =>
            void run(async () => {
              await writes.revoke(dialog.invitation.id)
              return t('toast.revoked')
            })
          }
        />
      )}
    </>
  )
}
