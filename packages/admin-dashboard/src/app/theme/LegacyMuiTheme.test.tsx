import { render, screen } from '@testing-library/react'
import { useTheme as useMuiTheme } from '@mui/material'
import { ThemeProvider } from './ThemeProvider'
import { LegacyMuiTheme } from './LegacyMuiTheme'
import { THEME_STORAGE_KEY } from './theme-utils'

function MuiMode() {
  return <span data-testid="mode">{useMuiTheme().palette.mode}</span>
}

afterEach(() => localStorage.clear())

it.each(['light', 'dark'] as const)('gives legacy MUI pages the %s palette', (pref) => {
  localStorage.setItem(THEME_STORAGE_KEY, pref)
  render(
    <ThemeProvider>
      <LegacyMuiTheme>
        <MuiMode />
      </LegacyMuiTheme>
    </ThemeProvider>,
  )
  expect(screen.getByTestId('mode')).toHaveTextContent(pref)
})
