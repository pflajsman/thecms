import { useTranslation } from 'react-i18next'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { entryTypeId } from '@/features/content/content-api'
import { useContentType, useEntry } from '@/features/content/queries'
import { EntryEditor } from '@/features/content/editor/EntryEditor'

/** The product's text and images: the entry editor for one language version, inside the product page. */
export function ProductContentTab({ productId, versionId }: { productId: string; versionId: string }) {
  const { t } = useTranslation('commerce')
  const entry = useEntry(versionId)
  const type = useContentType(entry.data ? entryTypeId(entry.data) : undefined)
  if (entry.isError || type.isError) {
    return <ErrorState message={t('product.contentError')} onRetry={() => { void entry.refetch(); void type.refetch() }} />
  }
  if (!entry.data || !type.data) return <Skeleton className="h-40 w-full" />
  return (
    <EntryEditor
      key={versionId}
      contentType={type.data}
      entry={entry.data}
      embedded={{
        backTo: '/commerce/products',
        backLabel: t('nav.products', { ns: 'shell' }),
        versionPath: (id) => `/commerce/products/${productId}/content/${id}`,
      }}
    />
  )
}
