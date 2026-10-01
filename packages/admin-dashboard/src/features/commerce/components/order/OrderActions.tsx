import { useTranslation } from 'react-i18next'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiErrorMessage } from '@/lib/api-error'
import type { Order } from '../../orders-api'
import { useOrderWrites } from '../../orders-queries'
import { availableActions } from '../../order-rules'
import { TextField } from '../TextField'

type DialogKind = 'paid' | 'ship' | 'cancel' | null

export function OrderActions({ order }: { order: Order }) {
  const { t } = useTranslation('orders')
  const writes = useOrderWrites()
  const can = availableActions(order)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [pending, setPending] = useState(false)

  const run = async (action: () => Promise<unknown>, done: string) => {
    setPending(true)
    try {
      await action()
      toast.success(done)
    } catch (error) {
      // Someone else may have changed the order: show why and load its real state.
      toast.error(apiErrorMessage(error))
      await writes.refresh(order.id)
    } finally {
      setPending(false)
      setDialog(null)
    }
  }

  const resend = (what: 'confirmation' | 'downloads') => void run(() => writes.resend(order.id, what), t('actions.resentDone'))
  const resendConfirmation = () => resend('confirmation')
  const resendDownloads = () => resend('downloads')

  return (
    <>
      <div role="group" aria-label={t('order.actionsLabel')} className="flex flex-wrap gap-2">
        {can.markPaid && <Button onClick={() => setDialog('paid')} disabled={pending}>{t('actions.markPaid')}</Button>}
        {can.ship && <Button onClick={() => setDialog('ship')} disabled={pending}>{t('actions.ship')}</Button>}
        {can.cancel && (
          <Button variant="outline" className="text-destructive" onClick={() => setDialog('cancel')} disabled={pending}>{t('actions.cancel')}</Button>
        )}
        {can.resendConfirmation && (
          <Button variant="outline" onClick={resendConfirmation} disabled={pending}>
            {t('actions.resendConfirmation')}
          </Button>
        )}
        {can.resendDownloads && (
          <Button variant="outline" onClick={resendDownloads} disabled={pending}>
            {t('actions.resendDownloads')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={dialog === 'paid'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('actions.markPaidTitle', { number: order.number })}
        description={t('actions.markPaidText')}
        confirmLabel={t('actions.markPaid')}
        pending={pending}
        onConfirm={() => void run(() => writes.markPaid(order.id), t('actions.paidDone'))}
      />
      <Dialog open={dialog === 'ship'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <ShipForm
            number={order.number}
            pending={pending}
            onSubmit={(tracking) => void run(() => writes.markShipped(order.id, tracking), t('actions.shippedDone'))}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === 'cancel'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <CancelForm
            number={order.number}
            paid={order.paymentStatus === 'PAID'}
            pending={pending}
            onKeep={() => setDialog(null)}
            onSubmit={(refunded) => void run(() => writes.cancel(order.id, refunded), t('actions.cancelledDone'))}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function isHttpUrl(text: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol)
  } catch {
    return false
  }
}

function ShipForm({ number, pending, onSubmit }: { number: string; pending: boolean; onSubmit: (tracking: { trackingNumber?: string; trackingUrl?: string }) => void }) {
  const { t } = useTranslation('orders')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [urlError, setUrlError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const url = trackingUrl.trim()
    if (url && !isHttpUrl(url)) return setUrlError(true)
    setUrlError(false)
    onSubmit({ ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}), ...(url ? { trackingUrl: url } : {}) })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t('actions.shipTitle', { number })}</DialogTitle>
        <DialogDescription>{t('actions.shipText')}</DialogDescription>
      </DialogHeader>
      <TextField id="tracking-number" label={t('actions.trackingNumber')} value={trackingNumber} onChange={setTrackingNumber} />
      <TextField id="tracking-url" type="url" label={t('actions.trackingUrl')} value={trackingUrl} onChange={setTrackingUrl} error={urlError ? t('actions.trackingUrlInvalid') : undefined} />
      <DialogFooter>
        <Button type="submit" disabled={pending}>{t('actions.ship')}</Button>
      </DialogFooter>
    </form>
  )
}

function CancelForm({ number, paid, pending, onKeep, onSubmit }: { number: string; paid: boolean; pending: boolean; onKeep: () => void; onSubmit: (refunded: boolean) => void }) {
  const { t } = useTranslation('orders')
  const [refunded, setRefunded] = useState(false)
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t('actions.cancelTitle', { number })}</DialogTitle>
        <DialogDescription>{t('actions.cancelText')}</DialogDescription>
      </DialogHeader>
      {paid && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={refunded} onChange={(e) => setRefunded(e.target.checked)} />
          {t('actions.refunded')}
        </label>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onKeep}>{t('actions.keep')}</Button>
        <Button variant="destructive" disabled={pending} onClick={() => onSubmit(paid && refunded)}>{t('actions.cancel')}</Button>
      </DialogFooter>
    </div>
  )
}
