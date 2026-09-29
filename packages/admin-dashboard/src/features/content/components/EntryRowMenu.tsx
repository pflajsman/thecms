import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import type { ContentType, EntryListItem } from '@/types'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEntryActions } from '../useEntryActions'

export function EntryRowMenu({ entry, type }: { entry: EntryListItem; type?: ContentType }) {
  const actions = useEntryActions()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${entry.title}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link to={`/content/${entry.id}`}>Open</Link>
          </DropdownMenuItem>
          {entry.status === 'DRAFT' && <DropdownMenuItem onSelect={() => actions.publish(entry)}>Publish</DropdownMenuItem>}
          {entry.status === 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.unpublish(entry)}>Unpublish</DropdownMenuItem>}
          {entry.status === 'ARCHIVED' ? (
            <DropdownMenuItem onSelect={() => actions.restore(entry)}>Restore to draft</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => actions.archive(entry)}>Archive</DropdownMenuItem>
          )}
          {entry.contentType && <DropdownMenuItem onSelect={() => actions.duplicate(entry, type)}>Duplicate</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${entry.title}”?`}
        description="This permanently removes the entry. Sites that show it will stop receiving it."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDelete(false)
          void actions.remove(entry)
        }}
      />
    </>
  )
}
