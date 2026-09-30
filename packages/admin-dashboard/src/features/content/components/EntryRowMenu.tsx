import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('content')
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('rowMenu.actionsFor', { title: entry.title })}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <Link to={`/content/${entry.id}`}>{t('rowMenu.open')}</Link>
          </DropdownMenuItem>
          {entry.status === 'DRAFT' && <DropdownMenuItem onSelect={() => actions.publish(entry)}>{t('rowMenu.publish')}</DropdownMenuItem>}
          {entry.status === 'PUBLISHED' && <DropdownMenuItem onSelect={() => actions.unpublish(entry)}>{t('rowMenu.unpublish')}</DropdownMenuItem>}
          {entry.status === 'ARCHIVED' ? (
            <DropdownMenuItem onSelect={() => actions.restore(entry)}>{t('rowMenu.restore')}</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => actions.archive(entry)}>{t('rowMenu.archive')}</DropdownMenuItem>
          )}
          {entry.contentType && <DropdownMenuItem onSelect={() => actions.duplicate(entry, type)}>{t('rowMenu.duplicate')}</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            {t('rowMenu.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('rowMenu.deleteTitle', { title: entry.title })}
        description={t('rowMenu.deleteText')}
        confirmLabel={t('rowMenu.delete')}
        destructive
        onConfirm={() => {
          setConfirmDelete(false)
          void actions.remove(entry)
        }}
      />
    </>
  )
}
