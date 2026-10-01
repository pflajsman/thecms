import { modules, createActions } from './registry'
import { groupModules, mobileTabModules } from './nav'
import { i18n } from '@/i18n'

describe('module registry', () => {
  it('has unique ids and paths', () => {
    expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length)
    expect(new Set(modules.map((m) => m.path)).size).toBe(modules.length)
  })

  it('matches the approved information architecture', () => {
    const { workspace, commerce, setup } = groupModules(modules)
    expect(workspace.map((m) => i18n.t(m.labelKey, { ns: 'shell' }))).toEqual(['Home', 'Content', 'Media', 'Inbox'])
    expect(commerce.map((m) => i18n.t(m.labelKey, { ns: 'shell' }))).toEqual(['Orders', 'Products', 'Shipping', 'Shop settings'])
    expect(setup.map((m) => i18n.t(m.labelKey, { ns: 'shell' }))).toEqual(['Content models', 'Forms', 'Sites & API keys', 'Webhooks', 'Languages'])
  })

  it('shows exactly Home, Content, Media and Inbox as mobile tabs', () => {
    expect(mobileTabModules(modules).map((m) => m.id)).toEqual(['home', 'content', 'media', 'inbox'])
  })

  it('offers create actions', () => {
    expect(createActions.map((a) => i18n.t(a.labelKey, { ns: 'shell' }))).toEqual(['New entry', 'Upload media'])
  })
})
