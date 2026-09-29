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
  return (
    <div className="flex">
      <Button className="rounded-r-none" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        New entry
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="rounded-l-none border-l border-primary-foreground/30 px-2" aria-label="New entry of type">
            <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {types.map((t) => (
            <DropdownMenuItem key={t.id} asChild>
              <Link to={`/content/new?type=${t.id}`}>{t.name}</Link>
            </DropdownMenuItem>
          ))}
          {types.length === 0 && (
            <DropdownMenuItem asChild>
              <Link to="/models">Create a content model</Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">New entry</DialogTitle>
            <DialogDescription>Choose what you want to create.</DialogDescription>
          </DialogHeader>
          <TypeChooser types={types} onChoose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
