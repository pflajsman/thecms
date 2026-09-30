import { getEventGroups, eventLabel, validateWebhook } from './webhook-events'
import { i18n } from '@/i18n'

it('groups every backend event', () => {
  expect(getEventGroups().map((g) => g.label)).toEqual(['Entries', 'Content models', 'Media'])
  expect(getEventGroups().flatMap((g) => g.events.map((e) => e.value))).toHaveLength(11)
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

it('labels groups, events and errors in Czech', async () => {
  await i18n.changeLanguage('cs')
  expect(getEventGroups().map((g) => g.label)).toEqual(['Položky', 'Modely obsahu', 'Média'])
  expect(eventLabel('entry.published')).toBe('Položka publikována')
  expect(eventLabel('custom.thing')).toBe('custom.thing')
  expect(validateWebhook({ name: '', url: 'ftp://x', events: [] })).toEqual({
    name: 'Název je povinný',
    url: 'Zadejte adresu začínající http nebo https',
    events: 'Vyberte alespoň jednu událost',
  })
})
