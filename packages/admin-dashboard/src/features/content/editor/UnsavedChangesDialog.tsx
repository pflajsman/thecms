import type { Blocker } from 'react-router-dom'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => { if (!open && blocker.state === 'blocked') blocker.reset() }}
      title="Leave without saving?"
      description="Your changes to this entry have not been saved."
      confirmLabel="Leave"
      destructive
      onConfirm={() => blocker.proceed?.()}
    />
  )
}
