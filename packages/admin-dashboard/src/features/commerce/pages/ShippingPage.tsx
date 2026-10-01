import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-error'
import { useLanguages } from '@/features/languages/languages-queries'
import type { ShippingMethod, ShippingZone } from '../shipping-api'
import { useMethods, useShippingWrites, useZones } from '../shipping-queries'
import { countryName } from '../countries'
import { ZoneDialog } from '../components/ZoneDialog'

/** Marks the zone dialog as creating a new zone. */
const NEW = 'new'

export function ShippingPage() {
  const { t, i18n } = useTranslation('shipping')
  const zones = useZones()
  const methods = useMethods()
  const languages = useLanguages()
  const writes = useShippingWrites()
  const [editing, setEditing] = useState<ShippingZone | typeof NEW | null>(null)
  const [removing, setRemoving] = useState<ShippingZone | null>(null)

  if (zones.isError || methods.isError)
    return <ErrorState message={t('page.loadError')} onRetry={() => { void zones.refetch(); void methods.refetch() }} />
  if (zones.isPending || methods.isPending) return <Skeleton className="h-40 w-full" />

  const defaultLanguage = languages.data?.find((l) => l.isDefault)?.code ?? 'en'
  const methodName = (m: ShippingMethod) => m.labels[defaultLanguage] || Object.values(m.labels)[0] || t('methods.untitled')
  const zoneNames = (m: ShippingMethod) => m.rates.map((r) => zones.data.find((z) => z.id === r.zoneId)?.name).filter(Boolean).join(', ')
  const paymentNames = (m: ShippingMethod) => m.paymentMethods.map((p) => t(`payment.${p}`)).join(', ')

  const remove = async () => {
    const zone = removing
    setRemoving(null)
    if (!zone) return
    try {
      await writes.removeZone(zone.id)
      toast.success(t('zones.removed'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader title={t('page.title')} description={t('page.description')} />
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="zones-title" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="zones-title" className="font-serif text-xl font-semibold">{t('zones.title')}</h2>
            <Button variant="outline" onClick={() => setEditing(NEW)}>{t('zones.add')}</Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('zones.hint')}</p>
          {zones.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('zones.empty')}</p>
          ) : (
            <ul aria-label={t('zones.title')} className="flex flex-col divide-y rounded-xl border bg-card">
              {zones.data.map((z) => (
                <li key={z.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{z.name}</p>
                    <p className="text-sm text-muted-foreground">{z.rest ? t('zones.rest') : z.countries.map((c) => countryName(c, i18n.language)).join(', ')}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={t('zones.edit', { name: z.name })} onClick={() => setEditing(z)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t('zones.remove', { name: z.name })} onClick={() => setRemoving(z)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="methods-title" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="methods-title" className="font-serif text-xl font-semibold">{t('methods.title')}</h2>
            {zones.data.length > 0 ? (
              <Button asChild>
                <Link to="/commerce/shipping/methods/new">{t('methods.add')}</Link>
              </Button>
            ) : (
              <Button disabled>{t('methods.add')}</Button>
            )}
          </div>
          {zones.data.length === 0 && <p className="text-sm text-muted-foreground">{t('methods.needsZone')}</p>}
          {methods.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('methods.empty')}</p>
          ) : (
            <ul aria-label={t('methods.tableLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
              {methods.data.map((m) => (
                <li key={m.id} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/commerce/shipping/methods/${m.id}`} className="font-medium hover:underline">{methodName(m)}</Link>
                    <p className="text-sm text-muted-foreground">{t('methods.summary', { zones: zoneNames(m), payment: paymentNames(m) })}</p>
                  </div>
                  <Badge variant={m.active ? 'default' : 'outline'}>{m.active ? t('methods.active') : t('methods.inactive')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ZoneDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} zone={editing && editing !== NEW ? editing : undefined} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('zones.removeTitle', { name: removing?.name ?? '' })}
        description={t('zones.removeText')}
        confirmLabel={t('actions.delete', { ns: 'common' })}
        destructive
        onConfirm={() => void remove()}
      />
    </>
  )
}
