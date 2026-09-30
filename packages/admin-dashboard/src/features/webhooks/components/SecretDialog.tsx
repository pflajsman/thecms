import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function SecretDialog({ secret, onDone }: { secret: string | null; onDone: () => void }) {
  const { t } = useTranslation('webhooks')
  const copy = () => void navigator.clipboard?.writeText(secret ?? '').then(() => toast.success(t('secret.copied')))
  return (
    <Dialog open={!!secret} onOpenChange={(open) => !open && onDone()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('secret.title')}</DialogTitle>
          <DialogDescription>
            {t('secret.showOnce')}
          </DialogDescription>
        </DialogHeader>
        <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{secret}</code>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy aria-hidden />
            {t('actions.copy', { ns: 'common' })}
          </Button>
          <Button onClick={onDone}>{t('secret.done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
