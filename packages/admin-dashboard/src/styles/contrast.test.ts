import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Vitest runs from the package root; css: false in the config keeps ?raw imports empty.
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

function tokens(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\}`))![1]
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Text/background pairs the UI actually renders.
const PAIRS: [string, string][] = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['primary', 'background'],
  ['primary', 'card'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['sidebar-foreground', 'sidebar'],
  ['sidebar-accent-foreground', 'sidebar-accent'],
  ['status-published-fg', 'status-published-bg'],
  ['status-published-fg', 'card'],
  ['status-draft-fg', 'status-draft-bg'],
  ['status-archived-fg', 'status-archived-bg'],
  ['status-unread-fg', 'status-unread-bg'],
]

it('sanity: the ratio math matches known values', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1)
})

describe.each([':root', '.dark'])('%s tokens', (selector) => {
  const t = tokens(selector)
  it.each(PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(t[fg], `missing --${fg}`).toBeDefined()
    expect(t[bg], `missing --${bg}`).toBeDefined()
    expect(contrastRatio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
  })
})
