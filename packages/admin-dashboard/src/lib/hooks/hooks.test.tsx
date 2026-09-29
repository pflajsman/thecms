import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Link, RouterProvider, useNavigate } from 'react-router-dom'
import { useHotkey } from './useHotkey'
import { useDebouncedValue } from './useDebouncedValue'
import { useAutosave } from './useAutosave'
import { useUnsavedGuard } from './useUnsavedGuard'

describe('useHotkey', () => {
  function Harness({ onN, onSave }: { onN: () => void; onSave: () => void }) {
    useHotkey('n', onN)
    useHotkey('s', onSave, { mod: true, allowInInputs: true })
    return <input aria-label="field" />
  }

  it('ignores plain keys while typing but allows mod shortcuts', async () => {
    const onN = vi.fn()
    const onSave = vi.fn()
    render(<Harness onN={onN} onSave={onSave} />)
    await userEvent.keyboard('n')
    expect(onN).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByLabelText('field'))
    await userEvent.keyboard('n')
    expect(onN).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Meta>}s{/Meta}')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not throw for key events without a key (autofill)', () => {
    render(<Harness onN={vi.fn()} onSave={vi.fn()} />)
    expect(() => window.dispatchEvent(new KeyboardEvent('keydown'))).not.toThrow()
  })
})

describe('useDebouncedValue', () => {
  it('updates after the delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    expect(result.current).toBe('a')
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('ab')
    vi.useRealTimers()
  })
})

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const base = { enabled: true, isDirty: true, isValid: true, changeKey: 'v1' }

  it('saves once, 2 seconds after the last change', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { rerender } = renderHook((props) => useAutosave({ ...props, save }), { initialProps: base })
    act(() => { vi.advanceTimersByTime(1500) })
    rerender({ ...base, changeKey: 'v2' })
    act(() => { vi.advanceTimersByTime(1500) })
    expect(save).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(500) })
    expect(save).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['disabled (published)', { enabled: false }],
    ['invalid', { isValid: false }],
    ['clean', { isDirty: false }],
  ])('does not save when %s', (_label, over) => {
    const save = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosave({ ...base, ...over, save }))
    act(() => { vi.advanceTimersByTime(5000) })
    expect(save).not.toHaveBeenCalled()
  })

  it('flush saves immediately', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave({ ...base, save }))
    act(() => result.current.flush())
    expect(save).toHaveBeenCalledTimes(1)
  })
})

describe('useUnsavedGuard', () => {
  function Page({ dirty }: { dirty: boolean }) {
    const blocker = useUnsavedGuard(dirty)
    const navigate = useNavigate()
    return (
      <div>
        <Link to="/other">leave</Link>
        <button onClick={() => navigate('/redirected', { state: { skipGuard: true } })}>redirect</button>
        <span data-testid="state">{blocker.state}</span>
      </div>
    )
  }

  function setup(dirty: boolean) {
    const router = createMemoryRouter(
      [
        { path: '/', element: <Page dirty={dirty} /> },
        { path: '/other', element: <p>other</p> },
        { path: '/redirected', element: <p>redirected</p> },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  it('blocks navigation when dirty', async () => {
    const router = setup(true)
    await userEvent.click(screen.getByText('leave'))
    expect(screen.getByTestId('state')).toHaveTextContent('blocked')
    expect(router.state.location.pathname).toBe('/')
  })

  it('lets navigation through when clean', async () => {
    setup(false)
    await userEvent.click(screen.getByText('leave'))
    expect(screen.getByText('other')).toBeInTheDocument()
  })

  it('never blocks navigations marked skipGuard', async () => {
    setup(true)
    await userEvent.click(screen.getByText('redirect'))
    expect(screen.getByText('redirected')).toBeInTheDocument()
  })
})
