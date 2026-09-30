import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core'

/**
 * Screen reader instructions and announcements for dnd-kit in the admin language.
 * `nameOf` turns an item id into what people see (a field label, a file name).
 */
export function useDndAccessibility(nameOf: (id: UniqueIdentifier) => string) {
  const { t } = useTranslation()
  return useMemo(() => {
    const screenReaderInstructions: ScreenReaderInstructions = { draggable: t('dnd.instructions') }
    const announcements: Announcements = {
      onDragStart: ({ active }) => t('dnd.picked', { name: nameOf(active.id) }),
      onDragOver: ({ active, over }) =>
        over ? t('dnd.over', { name: nameOf(active.id), target: nameOf(over.id) }) : t('dnd.notOver', { name: nameOf(active.id) }),
      onDragEnd: ({ active, over }) =>
        over ? t('dnd.dropped', { name: nameOf(active.id), target: nameOf(over.id) }) : t('dnd.droppedNowhere', { name: nameOf(active.id) }),
      onDragCancel: ({ active }) => t('dnd.cancelled', { name: nameOf(active.id) }),
    }
    return { screenReaderInstructions, announcements }
  }, [t, nameOf])
}
