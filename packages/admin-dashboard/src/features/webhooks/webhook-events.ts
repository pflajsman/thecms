export const EVENT_GROUPS: { label: string; events: { value: string; label: string }[] }[] = [
  {
    label: 'Entries',
    events: [
      { value: 'entry.created', label: 'Entry created' },
      { value: 'entry.updated', label: 'Entry updated' },
      { value: 'entry.deleted', label: 'Entry deleted' },
      { value: 'entry.published', label: 'Entry published' },
      { value: 'entry.unpublished', label: 'Entry unpublished' },
      { value: 'entry.archived', label: 'Entry archived' },
    ],
  },
  {
    label: 'Content models',
    events: [
      { value: 'content_type.created', label: 'Model created' },
      { value: 'content_type.updated', label: 'Model updated' },
      { value: 'content_type.deleted', label: 'Model deleted' },
    ],
  },
  {
    label: 'Media',
    events: [
      { value: 'media.uploaded', label: 'Media uploaded' },
      { value: 'media.deleted', label: 'Media deleted' },
    ],
  },
]

const LABELS = new Map(EVENT_GROUPS.flatMap((g) => g.events.map((e) => [e.value, e.label] as const)))

export function eventLabel(value: string): string {
  return LABELS.get(value) ?? value
}

export function validateWebhook(body: { name: string; url: string; events: string[] }): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!body.name.trim()) errors.name = 'Name is required'
  try {
    const url = new URL(body.url.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
  } catch {
    errors.url = 'Enter an http or https URL'
  }
  if (body.events.length === 0) errors.events = 'Choose at least one event'
  return errors
}
