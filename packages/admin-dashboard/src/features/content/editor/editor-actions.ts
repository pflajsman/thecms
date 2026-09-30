import type { EntryStatus } from '@/types'
import type editorEn from '@/i18n/locales/en/editor.json'

export type EditorActionLabelKey = `actions.${keyof typeof editorEn.actions & string}`

export type EditorAction = 'saveDraft' | 'publish' | 'publishChanges' | 'discard' | 'unpublish' | 'archive' | 'restore' | 'delete' | 'duplicate'

export interface EditorActionSet {
  primary: { action: EditorAction; labelKey: EditorActionLabelKey; disabled?: boolean }
  secondary?: { action: EditorAction; labelKey: EditorActionLabelKey }
  menu: { action: EditorAction; labelKey: EditorActionLabelKey; destructive?: boolean }[]
}

const DUPLICATE = { action: 'duplicate', labelKey: 'actions.duplicate' } as const
const UNPUBLISH = { action: 'unpublish', labelKey: 'actions.unpublish' } as const
const ARCHIVE = { action: 'archive', labelKey: 'actions.archive' } as const
const DELETE = { action: 'delete', labelKey: 'actions.delete', destructive: true } as const

export function getEditorActions({ isNew, status, isDirty }: { isNew: boolean; status: EntryStatus; isDirty: boolean }): EditorActionSet {
  if (isNew) {
    return { primary: { action: 'publish', labelKey: 'actions.publish' }, secondary: { action: 'saveDraft', labelKey: 'actions.saveDraft' }, menu: [] }
  }
  switch (status) {
    case 'PUBLISHED':
      return isDirty
        ? {
            primary: { action: 'publishChanges', labelKey: 'actions.publishChanges' },
            secondary: { action: 'discard', labelKey: 'actions.discard' },
            menu: [DUPLICATE, UNPUBLISH, ARCHIVE, DELETE],
          }
        : { primary: { action: 'publishChanges', labelKey: 'actions.published', disabled: true }, menu: [DUPLICATE, UNPUBLISH, ARCHIVE, DELETE] }
    case 'ARCHIVED':
      return { primary: { action: 'restore', labelKey: 'actions.restore' }, menu: [DUPLICATE, DELETE] }
    case 'DRAFT':
    default:
      return {
        primary: { action: 'publish', labelKey: 'actions.publish' },
        secondary: { action: 'saveDraft', labelKey: 'actions.saveDraft' },
        menu: [DUPLICATE, ARCHIVE, DELETE],
      }
  }
}
