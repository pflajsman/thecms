import { modules, createActions } from './registry'
import { groupModules, mobileTabModules } from './nav'

describe('module registry', () => {
  it('has unique ids and paths', () => {
    expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length)
    expect(new Set(modules.map((m) => m.path)).size).toBe(modules.length)
  })

  it('matches the approved information architecture', () => {
    const { workspace, setup } = groupModules(modules)
    expect(workspace.map((m) => m.label)).toEqual(['Home', 'Content', 'Media', 'Inbox'])
    expect(setup.map((m) => m.label)).toEqual(['Content models', 'Forms', 'Sites & API keys', 'Webhooks'])
  })

  it('shows exactly Home, Content, Media and Inbox as mobile tabs', () => {
    expect(mobileTabModules(modules).map((m) => m.id)).toEqual(['home', 'content', 'media', 'inbox'])
  })

  it('offers create actions', () => {
    expect(createActions.map((a) => a.label)).toEqual(['New entry', 'Upload media'])
  })
})
