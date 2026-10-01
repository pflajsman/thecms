import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import { toApiKey } from '@/features/builder/api-key'
import type { ShopSettings } from '../commerce-api'
import { useCommerceWrites, useShopSettings } from '../commerce-queries'

const CODE = /^[A-Z]{3}$/

/** Percent typed in the admin language (for example "12,5") to basis points, or null. */
function toBasisPoints(text: string, language: string): number | null {
  const decimal = new Intl.NumberFormat(language).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.'
  const normalized = text.trim().replace(decimal, '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  return value <= 100 ? Math.round(value * 100) : null
}

export function ShopSettingsPage() {
  const { t, i18n } = useTranslation('commerce')
  const settings = useShopSettings()
  const writes = useCommerceWrites()
  const [draft, setDraft] = useState<ShopSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [decimals, setDecimals] = useState('2')
  const [codeError, setCodeError] = useState<'invalid' | 'taken' | null>(null)
  const [vatName, setVatName] = useState('')
  const [vatRate, setVatRate] = useState('')
  const [vatError, setVatError] = useState<'name' | 'rate' | null>(null)

  useEffect(() => {
    if (settings.data && !draft) setDraft(settings.data)
  }, [settings.data, draft])

  const dirty = !!draft && !!settings.data && JSON.stringify(draft) !== JSON.stringify(settings.data)
  const blocker = useUnsavedGuard(dirty)
  const percent = (rate: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(rate / 100)

  if (settings.isError) return <ErrorState message={t('settings.loadError')} onRetry={() => void settings.refetch()} />
  if (!draft) return <Skeleton className="h-40 w-full" />

  const addCurrency = () => {
    const upper = code.trim().toUpperCase()
    if (!CODE.test(upper)) return setCodeError('invalid')
    if (draft.currencies.some((c) => c.code === upper)) return setCodeError('taken')
    setCodeError(null)
    setCode('')
    setDraft({ ...draft, currencies: [...draft.currencies, { code: upper, decimals: Number(decimals) }], defaultCurrency: draft.defaultCurrency ?? upper })
  }

  const removeCurrency = (removed: string) => {
    const currencies = draft.currencies.filter((c) => c.code !== removed)
    const defaultCurrency = draft.defaultCurrency === removed ? currencies[0]?.code : draft.defaultCurrency
    setDraft({ ...draft, currencies, defaultCurrency })
  }

  const addVat = () => {
    const name = vatName.trim()
    if (!name || name.length > 50) return setVatError('name')
    const rate = toBasisPoints(vatRate, i18n.language)
    if (rate === null) return setVatError('rate')
    setVatError(null)
    // Backend rule: ^[a-z0-9-]{1,40}$, so shorten the base to leave room for a -n suffix.
    const base = toApiKey(name).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40).replace(/-+$/, '') || 'rate'
    let id = base
    for (let n = 2; draft.vatRates.some((r) => r.id === id); n++) {
      const suffix = `-${n}`
      id = `${base.slice(0, 40 - suffix.length).replace(/-+$/, '')}${suffix}`
    }
    setVatName('')
    setVatRate('')
    setDraft({ ...draft, vatRates: [...draft.vatRates, { id, name, rate }] })
  }

  const save = async () => {
    if (draft.vatRates.some((r) => !r.name.trim())) {
      setVatError('name')
      return
    }
    setSaving(true)
    setServerError(null)
    try {
      const saved = await writes.saveSettings(draft)
      setDraft(saved)
      toast.success(t('settings.saved'))
    } catch (error) {
      // Shown inline above the sections; the reason stays visible while the user fixes it.
      setServerError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        description={t('settings.description')}
        actions={<Button onClick={() => void save()} disabled={saving || !dirty}>{t('settings.save')}</Button>}
      />
      {serverError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="currencies-title" className="min-w-0 space-y-3">
          <h2 id="currencies-title" className="font-serif text-xl font-semibold">{t('settings.currencies')}</h2>
          {draft.currencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.empty')}</p>
          ) : (
            <ul aria-label={t('settings.currencies')} className="flex flex-col divide-y rounded-xl border bg-card">
              {draft.currencies.map((c) => (
                <li key={c.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="w-12 font-mono font-medium">{c.code}</span>
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">{t('settings.decimalsValue', { count: c.decimals })}</span>
                  {draft.defaultCurrency === c.code ? (
                    <Badge variant="secondary">{t('settings.default')}</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, defaultCurrency: c.code })}>{t('settings.makeDefault')}</Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label={t('settings.removeCurrency', { code: c.code })} onClick={() => removeCurrency(c.code)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="currency-code">{t('settings.currencyCode')}</Label>
              <Input id="currency-code" value={code} onChange={(e) => setCode(e.target.value)} className="w-28 font-mono uppercase" aria-invalid={codeError ? true : undefined} aria-describedby={codeError ? 'currency-code-error' : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency-decimals">{t('settings.decimals')}</Label>
              <Select value={decimals} onValueChange={setDecimals}>
                <SelectTrigger id="currency-decimals" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['0', '1', '2', '3'].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={addCurrency}>{t('settings.addCurrency')}</Button>
          </div>
          {codeError && <p id="currency-code-error" className="text-sm text-destructive">{codeError === 'invalid' ? t('settings.codeInvalid') : t('settings.codeTaken')}</p>}
        </section>
        <section aria-labelledby="vat-title" className="min-w-0 space-y-3">
          <h2 id="vat-title" className="font-serif text-xl font-semibold">{t('settings.vatRates')}</h2>
          {draft.vatRates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.emptyVat')}</p>
          ) : (
            <ul aria-label={t('settings.vatRates')} className="flex flex-col divide-y rounded-xl border bg-card">
              {draft.vatRates.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <Input
                    aria-label={t('settings.vatRename', { name: settings.data?.vatRates.find((s) => s.id === r.id)?.name ?? r.name })}
                    value={r.name}
                    maxLength={50}
                    onChange={(e) => setDraft({ ...draft, vatRates: draft.vatRates.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) })}
                    className="h-8 min-w-0 flex-1"
                  />
                  <span className="text-sm text-muted-foreground">{t('settings.percent', { value: percent(r.rate) })}</span>
                  <Button variant="ghost" size="icon" aria-label={t('settings.removeVat', { name: r.name })} onClick={() => setDraft({ ...draft, vatRates: draft.vatRates.filter((x) => x.id !== r.id) })}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="vat-name">{t('settings.vatName')}</Label>
              <Input id="vat-name" value={vatName} onChange={(e) => setVatName(e.target.value)} className="w-44" aria-invalid={vatError === 'name' ? true : undefined} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vat-rate">{t('settings.vatRate')}</Label>
              <Input id="vat-rate" inputMode="decimal" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-24" aria-invalid={vatError === 'rate' ? true : undefined} />
            </div>
            <Button variant="outline" onClick={addVat}>{t('settings.addVat')}</Button>
          </div>
          {vatError && <p className="text-sm text-destructive">{vatError === 'name' ? t('settings.nameInvalid') : t('settings.rateInvalid')}</p>}
        </section>
      </div>
      <UnsavedChangesDialog blocker={blocker} />
    </>
  )
}
