import { useTranslation } from 'react-i18next'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useCommerceWrites, useProduct } from '../commerce-queries'
import { ProductContentTab } from '../components/ProductContentTab'
import { SellingTab } from '../components/SellingTab'

export function ProductPage() {
  const { id = '', versionId } = useParams()
  const { t } = useTranslation('commerce')
  const product = useProduct(id)
  const writes = useCommerceWrites()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (product.isPending) return <Skeleton className="h-40 w-full" />
  if (product.isError) return <ErrorState message={t('product.loadError')} onRetry={() => void product.refetch()} />
  const { entry } = product.data
  const contentVersion = versionId ?? entry.defaultVersionId
  const name = entry.name || t('product.untitled')

  const remove = async () => {
    setConfirmDelete(false)
    try {
      await writes.remove(id)
      toast.success(t('product.deleted', { name }))
      navigate('/commerce/products', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={name}
        description={t(`types.${product.data.product.type}`)}
        actions={
          <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            {t('product.delete')}
          </Button>
        }
      />
      <nav aria-label={t('product.sections')} className="mb-6 flex gap-1 border-b">
        <TabLink to={`/commerce/products/${id}`} active={!versionId}>{t('product.selling')}</TabLink>
        {contentVersion && (
          <TabLink to={`/commerce/products/${id}/content/${contentVersion}`} active={!!versionId}>{t('product.content')}</TabLink>
        )}
      </nav>
      {versionId ? <ProductContentTab productId={id} versionId={versionId} /> : <SellingTab detail={product.data} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('product.deleteTitle', { name })}
        description={t('product.deleteText')}
        confirmLabel={t('actions.delete', { ns: 'common' })}
        destructive
        confirmText={name}
        onConfirm={() => void remove()}
      />
    </>
  )
}

function TabLink({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-mb-px border-b-2 px-3 py-2 text-sm',
        active ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
