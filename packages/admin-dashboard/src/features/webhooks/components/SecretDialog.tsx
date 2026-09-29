import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function SecretDialog({ secret, onDone }: { secret: string | null; onDone: () => void }) {
  const copy = () => void navigator.clipboard?.writeText(secret ?? '').then(() => toast.success('Secret copied'))
  return (
    <Dialog open={!!secret} onOpenChange={(open) => !open && onDone()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signing secret</DialogTitle>
          <DialogDescription>
            Copy it now: it is shown only once. Use it to verify the X-Webhook-Signature header on each request.
          </DialogDescription>
        </DialogHeader>
        <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-sm break-all">{secret}</code>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy aria-hidden />
            Copy
          </Button>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
