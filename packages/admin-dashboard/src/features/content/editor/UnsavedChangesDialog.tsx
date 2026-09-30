import { useTranslation } from 'react-i18next'
import type { Blocker } from 'react-router-dom'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  const { t } = useTranslation('editor')
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => { if (!open && blocker.state === 'blocked') blocker.reset() }}
      title={t('confirm.leaveTitle')}
      description={t('confirm.leaveText')}
      confirmLabel={t('confirm.leave')}
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  )
}
