import { act, renderHook } from '@testing-library/react'
import type { Field } from '@/types'
import { stableStringify, useEntryForm } from './useEntryForm'

const fields: Field[] = [
  { name: 'title', label: 'Title', type: 'TEXT', required: true },
  { name: 'km', label: 'Distance', type: 'NUMBER', required: false },
]

it('stableStringify ignores key order', () => {
  expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }))
})

describe('useEntryForm', () => {
  it('tracks dirty state against the saved baseline', () => {
    const { result } = renderHook(() => useEntryForm(fields, { title: 'A' }))
    expect(result.current.isDirty).toBe(false)
    act(() => result.current.setValue('title', 'B'))
    expect(result.current.isDirty).toBe(true)
    act(() => result.current.markSaved({ title: 'B' }))
    expect(result.current.isDirty).toBe(false)
  })

  it('keeps later edits dirty when an older snapshot is marked saved', () => {
    const { result } = renderHook(() => useEntryForm(fields, { title: 'A' }))
    act(() => result.current.setValue('title', 'B'))
    const snapshot = result.current.values
    act(() => result.current.setValue('title', 'BC'))
    act(() => result.current.markSaved(snapshot))
    expect(result.current.isDirty).toBe(true)
  })

  it('shows errors only for touched fields until all are revealed', () => {
    const { result } = renderHook(() => useEntryForm(fields, {}))
    expect(result.current.errors).toEqual({ title: 'Title is required' })
    expect(result.current.visibleErrors).toEqual({})
    act(() => result.current.touch('title'))
    expect(result.current.visibleErrors).toEqual({ title: 'Title is required' })
    act(() => result.current.showAllErrors())
    expect(result.current.isValid).toBe(false)
  })

  it('reset restores values and baseline', () => {
    const { result } = renderHook(() => useEntryForm(fields, { title: 'A' }))
    act(() => result.current.setValue('title', 'B'))
    act(() => result.current.reset(result.current.baseline))
    expect(result.current.values).toEqual({ title: 'A' })
    expect(result.current.isDirty).toBe(false)
  })
})
