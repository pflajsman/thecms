import { i18n } from '@/i18n'

const GROUPS = [
  { key: 'entries', events: ['entry.created', 'entry.updated', 'entry.deleted', 'entry.published', 'entry.unpublished', 'entry.archived'] },
  { key: 'models', events: ['content_type.created', 'content_type.updated', 'content_type.deleted'] },
  { key: 'media', events: ['media.uploaded', 'media.deleted'] },
  { key: 'commerce', events: ['product.updated', 'product.deleted', 'stock.changed'] },
] as const

const KNOWN = new Set<string>(GROUPS.flatMap((g) => g.events))

/** Event groups with labels in the current language; built on each call so a language switch shows. */
export function getEventGroups(): { label: string; events: { value: string; label: string }[] }[] {
  return GROUPS.map((g) => ({
    label: i18n.t(`webhooks:groups.${g.key}`),
    events: g.events.map((value) => ({ value, label: eventLabel(value) })),
  }))
}

/** Event values contain dots, which i18next reads as nesting, so catalog keys use "_" instead. */
export function eventLabel(value: string): string {
  return KNOWN.has(value) ? i18n.t(`webhooks:events.${value.replace('.', '_')}`) : value
}

export function validateWebhook(body: { name: string; url: string; events: string[] }): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!body.name.trim()) errors.name = i18n.t('webhooks:validation.nameRequired')
  try {
    const url = new URL(body.url.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
  } catch {
    errors.url = i18n.t('webhooks:validation.url')
  }
  if (body.events.length === 0) errors.events = i18n.t('webhooks:validation.events')
  return errors
}
