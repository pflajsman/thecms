import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { apiErrorMessage } from '@/lib/api-error'
import type { ShopSettings } from '../commerce-api'
import { useCommerceWrites } from '../commerce-queries'
import { checkoutToForm, formToCheckout, type AccountForm, type CheckoutErrorKey, type CheckoutForm } from '../checkout-form'
import { TextField } from './TextField'

interface CheckoutSettingsSectionProps {
  settings: ShopSettings
  onDirty: (dirty: boolean) => void
}

export function CheckoutSettingsSection({ settings, onDirty }: CheckoutSettingsSectionProps) {
  const { t } = useTranslation('commerce')
  const writes = useCommerceWrites()
  const initial = useMemo(() => checkoutToForm(settings), [settings])
  // Not reset when settings change: a currency save must not wipe edits made here.
  const [form, setForm] = useState<CheckoutForm>(initial)
  const [errors, setErrors] = useState<Record<string, CheckoutErrorKey>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  useEffect(() => onDirty(dirty), [dirty, onDirty])

  const fieldError = (id: string) => (errors[id] ? t(`checkout.errors.${errors[id]}`) : undefined)
  const setAccount = (currency: string, patch: Partial<AccountForm>) =>
    setForm({ ...form, accounts: form.accounts.map((a) => (a.currency === currency ? { ...a, ...patch } : a)) })

  const save = async () => {
    const result = formToCheckout(form)
    setErrors(result.errors)
    if (!result.body) return
    setSaving(true)
    setServerError(null)
    try {
      const saved = await writes.saveSettings({ currencies: settings.currencies, defaultCurrency: settings.defaultCurrency, vatRates: settings.vatRates, ...result.body })
      setForm(checkoutToForm(saved))
      toast.success(t('checkout.saved'))
    } catch (error) {
      setServerError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="checkout-title" className="mt-10 min-w-0 space-y-4">
      <h2 id="checkout-title" className="font-serif text-xl font-semibold">{t('checkout.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('checkout.hint')}</p>
      {serverError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}
      <h3 className="font-medium">{t('checkout.bankAccounts')}</h3>
      {settings.currencies.length === 0 && <p className="text-sm text-muted-foreground">{t('checkout.noCurrencies')}</p>}
      <div className="space-y-3">
        {settings.currencies.map((c) => {
          const account = form.accounts.find((a) => a.currency === c.code)
          if (!account) {
            return (
              <Button key={c.code} variant="outline" onClick={() => setForm({ ...form, accounts: [...form.accounts, { currency: c.code, holder: '', accountNumber: '', iban: '', bic: '' }] })}>
                {t('checkout.addAccount', { code: c.code })}
              </Button>
            )
          }
          const id = `account-${c.code}`
          return (
            <fieldset key={c.code} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <legend className="font-medium">{t('checkout.accountFor', { code: c.code })}</legend>
                <Button variant="ghost" size="icon" aria-label={t('checkout.removeAccount', { code: c.code })} onClick={() => setForm({ ...form, accounts: form.accounts.filter((a) => a.currency !== c.code) })}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id={`${id}-holder`} label={t('checkout.holder')} value={account.holder} onChange={(holder) => setAccount(c.code, { holder })} error={fieldError(`${id}-holder`)} />
                <TextField id={`${id}-accountNumber`} label={t('checkout.accountNumber')} value={account.accountNumber} onChange={(accountNumber) => setAccount(c.code, { accountNumber })} error={fieldError(`${id}-accountNumber`)} />
                <TextField id={`${id}-iban`} label={t('checkout.iban')} hint={t('checkout.ibanHint')} value={account.iban} onChange={(iban) => setAccount(c.code, { iban })} error={fieldError(`${id}-iban`)} />
                <TextField id={`${id}-bic`} label={t('checkout.bic')} value={account.bic} onChange={(bic) => setAccount(c.code, { bic })} error={fieldError(`${id}-bic`)} />
              </div>
            </fieldset>
          )
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField id="unpaid-days" inputMode="numeric" label={t('checkout.unpaidCancelDays')} value={form.unpaidCancelDays} onChange={(unpaidCancelDays) => setForm({ ...form, unpaidCancelDays })} error={fieldError('unpaid-days')} />
        <TextField id="download-days" inputMode="numeric" label={t('checkout.downloadDays')} value={form.downloadDays} onChange={(downloadDays) => setForm({ ...form, downloadDays })} error={fieldError('download-days')} />
        <TextField id="download-limit" inputMode="numeric" label={t('checkout.downloadLimit')} value={form.downloadLimit} onChange={(downloadLimit) => setForm({ ...form, downloadLimit })} error={fieldError('download-limit')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="shop-email" type="email" label={t('checkout.shopEmail')} hint={t('checkout.shopEmailHint')} value={form.shopEmail} onChange={(shopEmail) => setForm({ ...form, shopEmail })} error={fieldError('shop-email')} />
        <TextField id="terms-url" type="url" label={t('checkout.termsUrl')} hint={t('checkout.termsUrlHint')} value={form.termsUrl} onChange={(termsUrl) => setForm({ ...form, termsUrl })} error={fieldError('terms-url')} />
      </div>
      <Button onClick={() => void save()} disabled={saving || !dirty}>{t('checkout.save')}</Button>
    </section>
  )
}
