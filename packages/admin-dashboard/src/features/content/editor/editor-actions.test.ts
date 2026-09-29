import { getEditorActions } from './editor-actions'

describe('getEditorActions', () => {
  it('new entry: publish or save draft', () => {
    const a = getEditorActions({ isNew: true, status: 'DRAFT', isDirty: false })
    expect(a.primary).toEqual({ action: 'publish', label: 'Publish' })
    expect(a.secondary).toEqual({ action: 'saveDraft', label: 'Save draft' })
    expect(a.menu).toEqual([])
  })

  it('draft: publish, save draft, and archive/delete in the menu', () => {
    const a = getEditorActions({ isNew: false, status: 'DRAFT', isDirty: true })
    expect(a.primary.action).toBe('publish')
    expect(a.secondary?.action).toBe('saveDraft')
    expect(a.menu.map((m) => m.action)).toEqual(['duplicate', 'archive', 'delete'])
  })

  it('published and clean: nothing to save', () => {
    const a = getEditorActions({ isNew: false, status: 'PUBLISHED', isDirty: false })
    expect(a.primary).toEqual({ action: 'publishChanges', label: 'Published', disabled: true })
    expect(a.secondary).toBeUndefined()
    expect(a.menu.map((m) => m.action)).toEqual(['duplicate', 'unpublish', 'archive', 'delete'])
  })

  it('published with changes: publish changes or discard', () => {
    const a = getEditorActions({ isNew: false, status: 'PUBLISHED', isDirty: true })
    expect(a.primary).toEqual({ action: 'publishChanges', label: 'Publish changes' })
    expect(a.secondary).toEqual({ action: 'discard', label: 'Discard changes' })
  })

  it('archived: restore to draft', () => {
    const a = getEditorActions({ isNew: false, status: 'ARCHIVED', isDirty: false })
    expect(a.primary).toEqual({ action: 'restore', label: 'Restore to draft' })
    expect(a.menu.map((m) => m.action)).toEqual(['duplicate', 'delete'])
  })
})
