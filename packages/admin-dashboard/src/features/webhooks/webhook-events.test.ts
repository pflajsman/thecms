import { EVENT_GROUPS, eventLabel, validateWebhook } from './webhook-events'

it('groups every backend event', () => {
  expect(EVENT_GROUPS.map((g) => g.label)).toEqual(['Entries', 'Content models', 'Media'])
  expect(EVENT_GROUPS.flatMap((g) => g.events.map((e) => e.value))).toHaveLength(11)
  expect(eventLabel('entry.published')).toBe('Entry published')
  expect(eventLabel('custom.thing')).toBe('custom.thing')
})

it('validates a webhook', () => {
  expect(validateWebhook({ name: '', url: 'ftp://x', events: [] })).toEqual({
    name: 'Name is required',
    url: 'Enter an http or https URL',
    events: 'Choose at least one event',
  })
  expect(validateWebhook({ name: 'Deploy', url: 'https://example.com/hook', events: ['entry.published'] })).toEqual({})
})
