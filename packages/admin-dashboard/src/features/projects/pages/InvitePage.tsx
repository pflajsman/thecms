import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { isAxiosError } from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Logo } from '@/components/common/Logo'
import { apiErrorMessage } from '@/lib/api-error'
import { setCurrentProjectId } from '@/lib/current-project'
import { SignInScreen } from '@/app/shell/SignInScreen'
import { ShellSkeleton } from '@/app/shell/ShellSkeleton'
import { useInvitePreview, useProjectWrites } from '../projects-queries'

/** /invite/:token, outside the shell: the person may not belong to any project yet. */
export function InviteRoute() {
  const { isLoading, isAuthenticated } = useAuth()
  if (isLoading) return <ShellSkeleton />
  // Signing in returns to this page (MSAL goes back to the URL it started from).
  if (!isAuthenticated) return <SignInScreen />
  return <InvitePage />
}

function InvitePage() {
  const { t } = useTranslation('projects')
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const preview = useInvitePreview(token)
  const writes = useProjectWrites()
  const [pending, setPending] = useState(false)

  const accept = async () => {
    setPending(true)
    try {
      const { projectId } = await writes.accept(token)
      setCurrentProjectId(projectId)
      toast.success(t('invite.accepted', { project: preview.data?.projectName }))
      navigate('/', { replace: true })
    } catch (error) {
      toast.error(apiErrorMessage(error))
      setPending(false)
    }
  }

  const invalid = preview.isError && isAxiosError(preview.error) && preview.error.response?.status === 410
  let body: React.ReactNode
  if (preview.isPending) body = <Skeleton className="h-24 w-full" />
  else if (preview.isError)
    body = (
      <>
        <h1 className="font-serif text-2xl font-semibold">{invalid ? t('invite.invalidTitle') : t('invite.loadError')}</h1>
        {invalid && <p className="mt-2 text-muted-foreground">{t('invite.invalidText')}</p>}
        <Button variant="outline" className="mt-6 w-full" onClick={() => navigate('/', { replace: true })}>{t('invite.home')}</Button>
      </>
    )
  else
    body = (
      <>
        <h1 className="font-serif text-3xl font-semibold">{t('invite.title')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('invite.text', { inviter: preview.data.invitedByName, project: preview.data.projectName, role: t(`roles.${preview.data.role}`) })}
        </p>
        <Button className="mt-6 w-full" size="lg" disabled={pending} onClick={() => void accept()}>{t('invite.accept')}</Button>
      </>
    )

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <Logo size={56} />
        </div>
        {body}
      </div>
    </main>
  )
}
