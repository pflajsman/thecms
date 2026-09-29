import { useMemo, type ReactNode } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material'
import { useTheme } from './useTheme'

// Legacy MUI pages only; removed in Plan 5 together with MUI.
// Hex values mirror tokens.css because createTheme cannot read CSS variables.
const PALETTES = {
  light: { primary: '#1f6f5c', paper: '#ffffff', text: '#2b2620', secondaryText: '#6b6257' },
  dark: { primary: '#5cc0a6', paper: '#24201c', text: '#f3ede3', secondaryText: '#b3a898' },
} as const

export function LegacyMuiTheme({ children }: { children: ReactNode }) {
  const { resolved } = useTheme()
  const theme = useMemo(() => {
    const p = PALETTES[resolved]
    return createTheme({
      palette: {
        mode: resolved,
        primary: { main: p.primary },
        background: { default: 'transparent', paper: p.paper },
        text: { primary: p.text, secondary: p.secondaryText },
      },
      shape: { borderRadius: 10 },
    })
  }, [resolved])

  return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
}
