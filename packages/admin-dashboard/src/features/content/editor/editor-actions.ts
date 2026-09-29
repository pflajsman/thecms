import type { EntryStatus } from '@/types'

export type EditorAction = 'saveDraft' | 'publish' | 'publishChanges' | 'discard' | 'unpublish' | 'archive' | 'restore' | 'delete' | 'duplicate'

export interface EditorActionSet {
  primary: { action: EditorAction; label: string; disabled?: boolean }
  secondary?: { action: EditorAction; label: string }
  menu: { action: EditorAction; label: string; destructive?: boolean }[]
}

const DUPLICATE = { action: 'duplicate', label: 'Duplicate' } as const
const UNPUBLISH = { action: 'unpublish', label: 'Unpublish' } as const
const ARCHIVE = { action: 'archive', label: 'Archive' } as const
const DELETE = { action: 'delete', label: 'Delete', destructive: true } as const

export function getEditorActions({ isNew, status, isDirty }: { isNew: boolean; status: EntryStatus; isDirty: boolean }): EditorActionSet {
  if (isNew) {
    return { primary: { action: 'publish', label: 'Publish' }, secondary: { action: 'saveDraft', label: 'Save draft' }, menu: [] }
  }
  switch (status) {
    case 'PUBLISHED':
      return isDirty
        ? {
            primary: { action: 'publishChanges', label: 'Publish changes' },
            secondary: { action: 'discard', label: 'Discard changes' },
            menu: [DUPLICATE, UNPUBLISH, ARCHIVE, DELETE],
          }
        : { primary: { action: 'publishChanges', label: 'Published', disabled: true }, menu: [DUPLICATE, UNPUBLISH, ARCHIVE, DELETE] }
    case 'ARCHIVED':
      return { primary: { action: 'restore', label: 'Restore to draft' }, menu: [DUPLICATE, DELETE] }
    case 'DRAFT':
    default:
      return {
        primary: { action: 'publish', label: 'Publish' },
        secondary: { action: 'saveDraft', label: 'Save draft' },
        menu: [DUPLICATE, ARCHIVE, DELETE],
      }
  }
}
