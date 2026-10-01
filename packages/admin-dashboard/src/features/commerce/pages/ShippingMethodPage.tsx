import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguages } from '@/features/languages/languages-queries'
import { useShopSettings } from '../commerce-queries'
import { useMethods, useZones } from '../shipping-queries'
import { MethodEditor } from '../components/MethodEditor'

export function ShippingMethodPage() {
  const { id } = useParams()
  const { t } = useTranslation('shipping')
  const zones = useZones()
  const methods = useMethods()
  const settings = useShopSettings()
  const languages = useLanguages()

  if (zones.isError || methods.isError || settings.isError || languages.isError) {
    const retry = () => {
      void zones.refetch()
      void methods.refetch()
      void settings.refetch()
      void languages.refetch()
    }
    return <ErrorState message={t('page.loadError')} onRetry={retry} />
  }
  if (zones.isPending || methods.isPending || settings.isPending || languages.isPending) return <Skeleton className="h-64 w-full" />

  const method = id === 'new' ? undefined : methods.data.find((m) => m.id === id)
  if (id !== 'new' && !method) return <ErrorState message={t('method.notFound')} />
  // Keyed by id so a new method's form resets once it has been created.
  return <MethodEditor key={id} method={method} zones={zones.data} currencies={settings.data.currencies} languages={languages.data} />
}
