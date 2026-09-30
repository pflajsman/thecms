import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { duplicateData } from '@/lib/entry-schema'
import type { ContentType, EntryListItem } from '@/types'
import { useEntryWrites } from './queries'

export function useEntryActions() {
  const writes = useEntryWrites()
  const navigate = useNavigate()
  const { t } = useTranslation('content')

  async function run(action: () => Promise<unknown>, message: string, undo?: () => Promise<unknown>) {
    try {
      await action()
      toast.success(message, undo ? {
        action: {
          label: t('actions.undo', { ns: 'common' }),
          onClick: () => {
            undo().then(() => toast.success(t('toast.undone'))).catch((e) => toast.error(apiErrorMessage(e)))
          },
        },
      } : undefined)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return {
    publish: (e: EntryListItem) => run(() => writes.publish(e.id), t('toast.published', { title: e.title })),
    unpublish: (e: EntryListItem) => run(() => writes.unpublish(e.id), t('toast.unpublished', { title: e.title }), () => writes.publish(e.id)),
    archive: (e: EntryListItem) =>
      run(() => writes.archive(e.id), t('toast.archived', { title: e.title }), () => writes.update({ id: e.id, body: { status: e.status } })),
    restore: (e: EntryListItem) => run(() => writes.update({ id: e.id, body: { status: 'DRAFT' } }), t('toast.restored', { title: e.title })),
    duplicate: async (e: EntryListItem, type?: ContentType) => {
      if (!e.contentType) return
      try {
        const data = type ? duplicateData(e.data, type.fields, type.titleField) : { ...e.data }
        const copy = await writes.create({ typeId: e.contentType.id, body: { data, status: 'DRAFT' } })
        toast.success(t('toast.duplicated', { title: e.title }))
        navigate(`/content/${copy.id}`)
      } catch (error) {
        toast.error(apiErrorMessage(error))
      }
    },
    remove: (e: EntryListItem) => run(() => writes.remove(e.id), t('toast.deleted', { title: e.title })),
  }
}
