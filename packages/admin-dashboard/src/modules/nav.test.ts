import { House, FileText, Boxes } from 'lucide-react'
import { collectRoutes, findActiveModule, groupModules, isModuleActive, mobileTabModules, pathMatches } from './nav'
import type { AppModule } from './types'

const mod = (over: Partial<AppModule>): AppModule => ({
  id: 'x', label: 'X', icon: House, group: 'workspace', path: '/x', routes: [], ...over,
})

const home = mod({ id: 'home', path: '/', mobileTab: true, routes: [{ index: true }] })
const content = mod({ id: 'content', icon: FileText, path: '/content', matches: ['/entries'], mobileTab: true, routes: [{ path: 'content' }] })
const models = mod({ id: 'models', icon: Boxes, group: 'setup', path: '/models', matches: ['/content-types'], routes: [{ path: 'models' }] })
const all = [home, content, models]

describe('pathMatches', () => {
  it('matches exact paths and child segments only', () => {
    expect(pathMatches('/content', '/content')).toBe(true)
    expect(pathMatches('/content/123', '/content')).toBe(true)
    expect(pathMatches('/content-types', '/content')).toBe(false)
    expect(pathMatches('/contents', '/content')).toBe(false)
  })
  it('treats / as exact only', () => {
    expect(pathMatches('/', '/')).toBe(true)
    expect(pathMatches('/media', '/')).toBe(false)
  })
})

describe('isModuleActive / findActiveModule', () => {
  it('uses legacy matches', () => {
    expect(isModuleActive(content, '/entries/abc/edit')).toBe(true)
  })
  it('does not confuse /content-types with Content', () => {
    expect(findActiveModule(all, '/content-types/new')?.id).toBe('models')
  })
  it('returns Home only for the root', () => {
    expect(findActiveModule(all, '/')?.id).toBe('home')
    expect(findActiveModule(all, '/unknown')).toBeUndefined()
  })
})

describe('grouping', () => {
  it('splits by group preserving order', () => {
    const { workspace, setup } = groupModules(all)
    expect(workspace.map((m) => m.id)).toEqual(['home', 'content'])
    expect(setup.map((m) => m.id)).toEqual(['models'])
  })
  it('selects mobile tabs', () => {
    expect(mobileTabModules(all).map((m) => m.id)).toEqual(['home', 'content'])
  })
  it('flattens routes', () => {
    expect(collectRoutes(all)).toHaveLength(3)
  })
})
