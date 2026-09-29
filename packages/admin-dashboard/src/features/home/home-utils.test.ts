import { getSetupSteps, greeting, publicApiBase, readSetupDismissed, writeSetupDismissed } from './home-utils'
import type { DashboardStats } from '@/types'

const stats = (over: Partial<DashboardStats> = {}): DashboardStats => ({
  entries: { total: 0, draft: 0, published: 0, archived: 0, byType: {} },
  contentTypes: 0,
  media: 0,
  sites: 0,
  submissions: { unread: 0 },
  ...over,
})

describe('getSetupSteps', () => {
  it('marks steps done from the stats', () => {
    expect(getSetupSteps(stats()).map((s) => [s.id, s.done])).toEqual([['signin', true], ['model', false], ['entry', false], ['site', false]])
    const done = getSetupSteps(stats({ contentTypes: 1, sites: 1, entries: { total: 3, draft: 3, published: 0, archived: 0, byType: {} } }))
    expect(done.every((s) => s.done)).toBe(true)
  })
  it('links each open step to where it is done', () => {
    expect(getSetupSteps(stats()).map((s) => s.to)).toEqual([undefined, '/content-types/new', '/content/new', '/sites/new'])
  })
})

describe('greeting', () => {
  it.each([
    [new Date(2026, 8, 29, 8), 'Good morning, Pavel'],
    [new Date(2026, 8, 29, 14), 'Good afternoon, Pavel'],
    [new Date(2026, 8, 29, 21), 'Good evening, Pavel'],
  ])('%s', (date, expected) => {
    expect(greeting(date, 'Pavel Flajsman')).toBe(expected)
  })
  it('works without a name', () => {
    expect(greeting(new Date(2026, 8, 29, 8))).toBe('Good morning')
  })
})

describe('setup dismissal', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })
  it('remembers dismissal', () => {
    expect(readSetupDismissed()).toBe(false)
    writeSetupDismissed()
    expect(readSetupDismissed()).toBe(true)
  })
  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readSetupDismissed()).toBe(false)
    expect(() => writeSetupDismissed()).not.toThrow()
  })
})

it('publicApiBase ends with /public', () => {
  expect(publicApiBase()).toMatch(/\/api\/v1\/public$/)
})
