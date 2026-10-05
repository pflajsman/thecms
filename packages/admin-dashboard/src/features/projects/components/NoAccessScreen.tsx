import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common/Logo'
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher'
import type { Me } from '../projects-api'

/** A signed-in user without any project: signing in grants nothing until someone invites them. */
export function NoAccessScreen({ me, onRetry }: { me: Me | undefined; onRetry: () => void }) {
  const { t } = useTranslation('projects')
  const { user, logout } = useAuth()
  const email = me?.email || user?.email || ''
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <Logo size={56} />
        </div>
        {me ? (
          <>
            <h1 className="font-serif text-3xl font-semibold">{t('noAccess.title')}</h1>
            <p className="mt-2 text-muted-foreground">{t('noAccess.text', { email })}</p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl font-semibold">{t('noAccess.loadError')}</h1>
            <Button className="mt-4" onClick={onRetry}>{t('noAccess.retry')}</Button>
          </>
        )}
        <Button variant="outline" className="mt-6 w-full" onClick={logout}>{t('noAccess.signOut')}</Button>
        <div className="mt-6">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  )
}
