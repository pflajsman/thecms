import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api-error'
import type { Order } from '../../orders-api'
import { useOrderWrites } from '../../orders-queries'

export function InternalNote({ order }: { order: Order }) {
  const { t } = useTranslation('orders')
  const writes = useOrderWrites()
  const [note, setNote] = useState(order.internalNote ?? '')
  const [saving, setSaving] = useState(false)
  const unchanged = note === (order.internalNote ?? '')

  const save = async () => {
    setSaving(true)
    try {
      await writes.saveNote(order.id, note)
      toast.success(t('order.noteSaved'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-2 rounded-xl border bg-card px-4 py-3">
      <Label htmlFor="internal-note" className="font-serif text-lg font-semibold">{t('order.internalNote')}</Label>
      <p id="internal-note-hint" className="text-xs text-muted-foreground">{t('order.internalNoteHint')}</p>
      <Textarea id="internal-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} aria-describedby="internal-note-hint" />
      <Button variant="outline" size="sm" onClick={() => void save()} disabled={saving || unchanged}>{t('order.saveNote')}</Button>
    </section>
  )
}
