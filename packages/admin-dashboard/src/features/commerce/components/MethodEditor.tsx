import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import type { Language } from '@/features/languages/languages-api'
import type { ShopCurrency } from '../commerce-api'
import { PAYMENT_METHODS, type PaymentMethod } from '../orders-api'
import type { ShippingMethod, ShippingZone } from '../shipping-api'
import { useShippingWrites } from '../shipping-queries'
import { emptyBand, formToMethod, methodToForm, type BandForm, type MethodErrorKey, type MethodForm } from '../shipping-form'
import { fromMinor } from '../money'
import { TextField } from './TextField'

interface MethodEditorProps {
  method?: ShippingMethod
  zones: ShippingZone[]
  currencies: ShopCurrency[]
  languages: Language[]
}

export function MethodEditor({ method, zones, currencies, languages }: MethodEditorProps) {
  const { t, i18n } = useTranslation('shipping')
  const language = i18n.language
  const navigate = useNavigate()
  const writes = useShippingWrites()
  const defaultLanguage = languages.find((l) => l.isDefault)?.code ?? languages[0]?.code ?? 'en'
  const initial = useMemo(() => methodToForm(method, currencies, language), [method, currencies, language])
  const [form, setForm] = useState<MethodForm>(initial)
  const [errors, setErrors] = useState<Record<string, MethodErrorKey>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const blocker = useUnsavedGuard(dirty)

  const name = method ? method.labels[defaultLanguage] || t('methods.untitled') : t('method.newTitle')
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? t('method.unknownZone')
  const unusedZones = zones.filter((z) => !form.rates.some((r) => r.zoneId === z.id))
  const fieldError = (id: string) => {
    const key = errors[id]
    if (!key) return undefined
    return key === 'money' ? t('method.errors.money', { example: fromMinor(12900, 2, language) }) : t(`method.errors.${key}`)
  }

  const bandPriceMissing = (i: number, j: number) => !!errors[`rate:${i}:band:${j}:price`]

  const update = (patch: Partial<MethodForm>) => setForm({ ...form, ...patch })
  const togglePayment = (pm: PaymentMethod) =>
    update({ paymentMethods: PAYMENT_METHODS.filter((p) => (p === pm ? !form.paymentMethods.includes(p) : form.paymentMethods.includes(p))) })
  const setBand = (i: number, j: number, patch: Partial<BandForm>) =>
    update({ rates: form.rates.map((r, ri) => (ri !== i ? r : { ...r, bands: r.bands.map((b, bj) => (bj === j ? { ...b, ...patch } : b)) })) })
  const addBand = (i: number) => update({ rates: form.rates.map((r, ri) => (ri === i ? { ...r, bands: [...r.bands, emptyBand(currencies)] } : r)) })
  const removeBand = (i: number, j: number) => update({ rates: form.rates.map((r, ri) => (ri === i ? { ...r, bands: r.bands.filter((_, bj) => bj !== j) } : r)) })
  const addRate = (zoneId: string) => update({ rates: [...form.rates, { zoneId, bands: [emptyBand(currencies)] }] })
  const removeRate = (i: number) => update({ rates: form.rates.filter((_, ri) => ri !== i) })

  const save = async () => {
    const result = formToMethod(form, currencies, language, defaultLanguage)
    setErrors(result.errors)
    setServerError(null)
    if (!result.body) return
    setSaving(true)
    try {
      const saved = await writes.saveMethod(method?.id, result.body)
      toast.success(t('method.saved'))
      if (method) setForm(methodToForm(saved, currencies, language))
      else navigate(`/commerce/shipping/methods/${saved.id}`, { replace: true, state: { skipGuard: true } })
    } catch (error) {
      setServerError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!method) return
    try {
      await writes.removeMethod(method.id)
      toast.success(t('method.deleted'))
      navigate('/commerce/shipping', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setConfirmDelete(false)
    }
  }

  const sectionTitle = 'font-serif text-xl font-semibold'
  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/commerce/shipping" className="text-sm text-muted-foreground hover:underline">{t('method.back')}</Link>}
        title={name}
        actions={
          <div className="flex flex-wrap gap-2">
            {method && (
              <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>{t('method.delete')}</Button>
            )}
            <Button onClick={() => void save()} disabled={saving || (!!method && !dirty)}>{t('method.save')}</Button>
          </div>
        }
      />
      {(serverError || Object.keys(errors).length > 0) && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError ?? t('method.fixErrors')}</div>
      )}
      <div className="space-y-8">
        <section aria-labelledby="method-general" className="min-w-0 space-y-3">
          <h2 id="method-general" className={sectionTitle}>{t('method.general')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {languages.map((l) => (
              <TextField
                key={l.code}
                id={`label-${l.code}`}
                label={t('method.label', { language: l.name })}
                value={form.labels[l.code] ?? ''}
                onChange={(value) => update({ labels: { ...form.labels, [l.code]: value } })}
                error={fieldError(`label:${l.code}`)}
              />
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Switch id="method-active" checked={form.active} onCheckedChange={(active) => update({ active })} aria-describedby="method-active-hint" />
              <Label htmlFor="method-active">{t('method.active')}</Label>
            </div>
            <p id="method-active-hint" className="text-xs text-muted-foreground">{t('method.activeHint')}</p>
          </div>
        </section>

        <section aria-labelledby="method-payment" className="min-w-0 space-y-3">
          <h2 id="method-payment" className={sectionTitle}>{t('method.payment')}</h2>
          <p className="text-sm text-muted-foreground">{t('method.paymentHint')}</p>
          <div className="flex flex-wrap gap-4">
            {PAYMENT_METHODS.map((pm) => (
              <label key={pm} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={form.paymentMethods.includes(pm)} onChange={() => togglePayment(pm)} />
                {t(`payment.${pm}`)}
              </label>
            ))}
          </div>
          {errors.payment && <p className="text-sm text-destructive">{t('method.errors.paymentRequired')}</p>}
          {form.paymentMethods.includes('CASH_ON_DELIVERY') && (
            <div className="flex flex-wrap gap-3">
              {currencies.map((c) => (
                <TextField
                  key={c.code}
                  id={`cod-${c.code}`}
                  inputMode="decimal"
                  className="w-56"
                  label={t('method.codFeeLabel', { code: c.code })}
                  value={form.codFees[c.code] ?? ''}
                  onChange={(value) => update({ codFees: { ...form.codFees, [c.code]: value } })}
                  error={fieldError(`cod:${c.code}`)}
                />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="method-free" className="min-w-0 space-y-3">
          <h2 id="method-free" className={sectionTitle}>{t('method.freeOver')}</h2>
          <p className="text-sm text-muted-foreground">{t('method.freeOverHint')}</p>
          <div className="flex flex-wrap gap-3">
            {currencies.map((c) => (
              <TextField
                key={c.code}
                id={`free-${c.code}`}
                inputMode="decimal"
                className="w-56"
                label={t('method.freeOverLabel', { code: c.code })}
                value={form.freeOver[c.code] ?? ''}
                onChange={(value) => update({ freeOver: { ...form.freeOver, [c.code]: value } })}
                error={fieldError(`free:${c.code}`)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="method-rates" className="min-w-0 space-y-3">
          <h2 id="method-rates" className={sectionTitle}>{t('method.rates')}</h2>
          <p className="text-sm text-muted-foreground">{t('method.ratesHint')}</p>
          {errors.rates && <p className="text-sm text-destructive">{t('method.errors.ratesRequired')}</p>}
          {form.rates.map((rate, i) => (
            <div key={rate.zoneId} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{zoneName(rate.zoneId)}</h3>
                <Button variant="ghost" size="sm" onClick={() => removeRate(i)}>{t('method.removeZone', { name: zoneName(rate.zoneId) })}</Button>
              </div>
              <ul className="space-y-3">
                {rate.bands.map((band, j) => (
                  <li key={j} className="flex flex-wrap items-start gap-3">
                    <TextField
                      id={`rate-${i}-band-${j}-upTo`}
                      inputMode="numeric"
                      className="w-44"
                      label={t('method.upToLabel', { n: j + 1 })}
                      hint={j === rate.bands.length - 1 ? t('method.noLimitHint') : undefined}
                      value={band.upTo}
                      onChange={(upTo) => setBand(i, j, { upTo })}
                      error={fieldError(`rate:${i}:band:${j}:upTo`)}
                    />
                    {currencies.map((c) => (
                      <TextField
                        key={c.code}
                        id={`rate-${i}-band-${j}-${c.code}`}
                        inputMode="decimal"
                        className="w-44"
                        label={t('method.priceLabel', { code: c.code, n: j + 1 })}
                        value={band.prices[c.code] ?? ''}
                        onChange={(value) => setBand(i, j, { prices: { ...band.prices, [c.code]: value } })}
                        error={fieldError(`rate:${i}:band:${j}:price:${c.code}`)}
                      />
                    ))}
                    {rate.bands.length > 1 && (
                      <Button variant="ghost" size="icon" className="mt-6" aria-label={t('method.removeBand', { n: j + 1 })} onClick={() => removeBand(i, j)}>
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                    {bandPriceMissing(i, j) && <p className="w-full text-sm text-destructive">{t('method.errors.bandPrice')}</p>}
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" onClick={() => addBand(i)}>{t('method.addBand')}</Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {unusedZones.map((z) => (
              <Button key={z.id} variant="outline" size="sm" onClick={() => addRate(z.id)}>{t('method.addZoneRates', { name: z.name })}</Button>
            ))}
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('method.deleteTitle', { name })}
        description={t('method.deleteText')}
        confirmLabel={t('actions.delete', { ns: 'common' })}
        destructive
        onConfirm={() => void remove()}
      />
      <UnsavedChangesDialog blocker={blocker} />
    </>
  )
}
