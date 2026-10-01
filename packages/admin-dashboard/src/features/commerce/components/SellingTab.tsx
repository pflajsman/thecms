import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/common/ErrorState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import { useLanguages } from '@/features/languages/languages-queries'
import type { ProductDetail } from '../commerce-api'
import { useCommerceWrites, useShopSettings } from '../commerce-queries'
import { OptionsEditor } from './OptionsEditor'
import { VariantsTable } from './VariantsTable'
import { DigitalFileSection } from './DigitalFileSection'

export function SellingTab({ detail }: { detail: ProductDetail }) {
  const { t, i18n } = useTranslation('commerce')
  const settings = useShopSettings()
  const languages = useLanguages().data ?? []
  const writes = useCommerceWrites()
  const { product, variants, entry } = detail
  const [vatRateId, setVatRateId] = useState(product.vatRateId)
  const [active, setActive] = useState(product.active)
  const [saving, setSaving] = useState(false)
  const [optionsDirty, setOptionsDirty] = useState(false)
  const [variantsDirty, setVariantsDirty] = useState(false)
  useEffect(() => {
    setVatRateId(product.vatRateId)
    setActive(product.active)
  }, [product.vatRateId, product.active])

  const generalDirty = vatRateId !== product.vatRateId || active !== product.active
  const blocker = useUnsavedGuard(generalDirty || optionsDirty || variantsDirty)
  const onOptionsDirty = useCallback((d: boolean) => setOptionsDirty(d), [])
  const onVariantsDirty = useCallback((d: boolean) => setVariantsDirty(d), [])
  const percent = (rate: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(rate / 100)
  const defaultLanguage = languages.find((l) => l.isDefault)?.code ?? 'en'

  if (settings.isError) return <ErrorState message={t('settings.loadError')} onRetry={() => void settings.refetch()} />
  if (!settings.data) return <Skeleton className="h-40 w-full" />

  const saveGeneral = async () => {
    setSaving(true)
    try {
      const body: { vatRateId?: string; active?: boolean } = {}
      if (vatRateId !== product.vatRateId) body.vatRateId = vatRateId
      if (active !== product.active) body.active = active
      await writes.update(product.id, body)
      toast.success(t('selling.saved'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="general-title" className="space-y-4">
        <h2 id="general-title" className="font-serif text-xl font-semibold">{t('selling.general')}</h2>
        <dl className="text-sm">
          <dt className="text-muted-foreground">{t('selling.type')}</dt>
          <dd>{t(`types.${product.type}`)}</dd>
        </dl>
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="vat-rate-select">{t('selling.vatRate')}</Label>
          <Select value={vatRateId} onValueChange={setVatRateId}>
            <SelectTrigger id="vat-rate-select" aria-label={t('selling.vatRate')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {settings.data.vatRates.map((r) => (
                <SelectItem key={r.id} value={r.id}>{t('selling.vatOption', { name: r.name, rate: percent(r.rate) })}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex max-w-md items-start justify-between gap-4">
          <div>
            <Label htmlFor="product-active">{t('selling.active')}</Label>
            <p className="text-sm text-muted-foreground">{t('selling.activeHint')}</p>
          </div>
          <Switch id="product-active" checked={active} onCheckedChange={setActive} />
        </div>
        <Button onClick={() => void saveGeneral()} disabled={!generalDirty || saving}>{t('selling.saveGeneral')}</Button>
      </section>
      <OptionsEditor productId={product.id} options={product.options} variants={variants} languages={languages} onDirty={onOptionsDirty} variantsDirty={variantsDirty} />
      <VariantsTable
        productId={product.id}
        productName={entry.name}
        type={product.type}
        options={product.options}
        variants={variants}
        currencies={settings.data.currencies}
        defaultLanguage={defaultLanguage}
        onDirty={onVariantsDirty}
      />
      {product.type === 'DIGITAL' && <DigitalFileSection productId={product.id} file={product.digitalFile} />}
      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}
