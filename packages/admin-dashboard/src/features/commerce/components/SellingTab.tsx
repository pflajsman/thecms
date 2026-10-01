import { useTranslation } from 'react-i18next'
import type { ProductDetail } from '../commerce-api'

/** Placeholder until the Selling tab lands. */
export function SellingTab({ detail }: { detail: ProductDetail }) {
  const { t } = useTranslation('commerce')
  return <p className="text-muted-foreground">{t(`types.${detail.product.type}`)}</p>
}
