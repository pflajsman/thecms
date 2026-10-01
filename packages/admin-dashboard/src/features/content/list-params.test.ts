import { parseListParams, serializeListParams, toEntryQuery } from './list-params'

describe('list params', () => {
  it('parses valid params', () => {
    const p = parseListParams(new URLSearchParams('type=aaaaaaaaaaaaaaaaaaaaaaaa&status=DRAFT&q=sum&sort=title&page=2'))
    expect(p).toEqual({ type: 'aaaaaaaaaaaaaaaaaaaaaaaa', status: 'DRAFT', q: 'sum', sort: 'title', page: 2 })
  })

  it('ignores tampered values', () => {
    expect(parseListParams(new URLSearchParams('type=not-an-id&status=SECRET&sort=data.x&page=abc'))).toEqual({ sort: 'updatedAt', page: 1 })
    expect(parseListParams(new URLSearchParams('page=-3')).page).toBe(1)
  })

  it('serializes without defaults', () => {
    expect(serializeListParams({ sort: 'updatedAt', page: 1 }).toString()).toBe('')
    expect(serializeListParams({ q: 'x', sort: 'title', page: 3 }).toString()).toBe('q=x&sort=title&page=3')
  })

  it('maps to the API query, title ascending', () => {
    expect(toEntryQuery({ sort: 'title', page: 2, q: 'a' })).toEqual({ search: 'a', sortBy: 'title', sortOrder: 'asc', page: 2, limit: 20, contentTypeId: undefined, status: undefined })
    expect(toEntryQuery({ sort: 'updatedAt', page: 1 }).sortOrder).toBe('desc')
  })
})

describe('language filters', () => {
  it('reads and writes the language filters', () => {
    const p = parseListParams(new URLSearchParams('lang=cs&missing=de'))
    expect(p).toMatchObject({ lang: 'cs', missing: 'de' })
    expect(serializeListParams(p).toString()).toBe('lang=cs&missing=de')
    expect(toEntryQuery(p)).toMatchObject({ language: 'cs', missing: 'de' })
  })

  it('ignores malformed language codes', () => {
    const p = parseListParams(new URLSearchParams('lang=Czech!&missing=x'))
    expect(p).not.toHaveProperty('lang')
    expect(p).not.toHaveProperty('missing')
  })
})
