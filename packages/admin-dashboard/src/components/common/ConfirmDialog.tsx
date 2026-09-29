import { useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  destructive?: boolean
  /** When set, the user must type this exact text before confirming. */
  confirmText?: string
  pending?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({ open, onOpenChange, ...rest }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the typed text resets on every open. */}
      <AlertDialogContent>
        <ConfirmBody {...rest} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ConfirmBody({
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  confirmText,
  pending = false,
  onConfirm,
}: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>) {
  const [typed, setTyped] = useState('')
  const locked = confirmText !== undefined && typed !== confirmText

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle className="font-serif text-xl">{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {confirmText !== undefined && (
        <div className="space-y-2">
          <Label htmlFor="confirm-text">
            Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
          </Label>
          <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      )}
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <Button variant={destructive ? 'destructive' : 'default'} disabled={locked || pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  )
}
