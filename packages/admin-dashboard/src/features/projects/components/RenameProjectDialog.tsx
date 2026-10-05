import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RenameProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  pending: boolean
  onSubmit: (name: string) => void
}

export function RenameProjectDialog({ open, onOpenChange, ...rest }: RenameProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the form resets on every open. */}
      <DialogContent>
        <RenameForm {...rest} />
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({ name: initial, pending, onSubmit }: Omit<RenameProjectDialogProps, 'open' | 'onOpenChange'>) {
  const { t } = useTranslation('projects')
  const [name, setName] = useState(initial)
  const [submitted, setSubmitted] = useState(false)
  const error = name.trim() === '' || name.trim().length > 100 ? t('renameForm.nameRequired') : undefined
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        if (!error) onSubmit(name.trim())
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t('renameForm.title')}</DialogTitle>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="project-name">{t('renameForm.name')}</Label>
        <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && error ? true : undefined} />
        {submitted && error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>{t('renameForm.save')}</Button>
      </DialogFooter>
    </form>
  )
}
