import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Store } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

/** Shown instead of products while the shop has no currency or VAT rate. */
export function ShopSetupPrompt() {
  const { t } = useTranslation('commerce')
  return (
    <EmptyState
      icon={Store}
      title={t('setup.title')}
      description={t('setup.text')}
      action={
        <Button asChild>
          <Link to="/commerce/settings">{t('setup.action')}</Link>
        </Button>
      }
    />
  )
}
