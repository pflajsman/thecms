import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/common/Logo'
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher'

export function SignInScreen() {
  const { login } = useAuth()
  const { t } = useTranslation('shell')
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <Logo size={56} />
        </div>
        <h1 className="font-serif text-3xl font-semibold">{t('signIn.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('signIn.subtitle')}</p>
        <Button className="mt-6 w-full" size="lg" onClick={login}>
          {t('signIn.button')}
        </Button>
        <div className="mt-6">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  )
}
