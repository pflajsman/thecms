import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { duplicateData } from '@/lib/entry-schema'
import type { ContentType, EntryListItem } from '@/types'
import { useEntryWrites } from './queries'

export function useEntryActions() {
  const writes = useEntryWrites()
  const navigate = useNavigate()

  async function run(action: () => Promise<unknown>, message: string, undo?: () => Promise<unknown>) {
    try {
      await action()
      toast.success(message, undo ? {
        action: {
          label: 'Undo',
          onClick: () => {
            undo().then(() => toast.success('Undone')).catch((e) => toast.error(apiErrorMessage(e)))
          },
        },
      } : undefined)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return {
    publish: (e: EntryListItem) => run(() => writes.publish(e.id), `Published “${e.title}”`),
    unpublish: (e: EntryListItem) => run(() => writes.unpublish(e.id), `Unpublished “${e.title}”`, () => writes.publish(e.id)),
    archive: (e: EntryListItem) =>
      run(() => writes.archive(e.id), `Archived “${e.title}”`, () => writes.update({ id: e.id, body: { status: e.status } })),
    restore: (e: EntryListItem) => run(() => writes.update({ id: e.id, body: { status: 'DRAFT' } }), `Restored “${e.title}” to draft`),
    duplicate: async (e: EntryListItem, type?: ContentType) => {
      if (!e.contentType) return
      try {
        const data = type ? duplicateData(e.data, type.fields, type.titleField) : { ...e.data }
        const copy = await writes.create({ typeId: e.contentType.id, body: { data, status: 'DRAFT' } })
        toast.success(`Duplicated “${e.title}”`)
        navigate(`/content/${copy.id}`)
      } catch (error) {
        toast.error(apiErrorMessage(error))
      }
    },
    remove: (e: EntryListItem) => run(() => writes.remove(e.id), `Deleted “${e.title}”`),
  }
}
