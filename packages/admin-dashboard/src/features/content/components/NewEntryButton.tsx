import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus } from 'lucide-react'
import type { ContentType } from '@/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { TypeChooser } from './TypeChooser'

export function NewEntryButton({ types }: { types: ContentType[] }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('content')
  return (
    <div className="flex">
      <Button className="rounded-r-none" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t('newEntry.button')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="rounded-l-none border-l border-primary-foreground/30 px-2" aria-label={t('newEntry.ofType')}>
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {types.map((type) => (
            <DropdownMenuItem key={type.id} asChild>
              <Link to={`/content/new?type=${type.id}`}>{type.name}</Link>
            </DropdownMenuItem>
          ))}
          {types.length === 0 && (
            <DropdownMenuItem asChild>
              <Link to="/models">{t('newEntry.createModel')}</Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{t('newEntry.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('newEntry.dialogText')}</DialogDescription>
          </DialogHeader>
          <TypeChooser types={types} onChoose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
