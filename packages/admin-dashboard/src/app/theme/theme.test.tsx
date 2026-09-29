import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'
import { readThemePreference, resolveTheme, THEME_STORAGE_KEY } from './theme-utils'

function Probe() {
  const { preference, resolved, setPreference } = useTheme()
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setPreference('dark')}>dark</button>
    </div>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  try { localStorage.clear() } catch { /* ignore */ }
})

describe('resolveTheme', () => {
  it('follows the system for system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
  it('returns explicit preferences as-is', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('readThemePreference', () => {
  it('defaults to system for missing or invalid values', () => {
    expect(readThemePreference()).toBe('system')
    localStorage.setItem(THEME_STORAGE_KEY, 'purple')
    expect(readThemePreference()).toBe('system')
  })
  it('falls back to system when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readThemePreference()).toBe('system')
  })
})

describe('ThemeProvider', () => {
  it('applies the dark class and persists the choice', async () => {
    render(<ThemeProvider><Probe /></ThemeProvider>)
    await userEvent.click(screen.getByText('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('still switches theme in memory when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(screen.getByTestId('pref')).toHaveTextContent('system')
    await act(async () => { await userEvent.click(screen.getByText('dark')) })
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })
})
