import { safeHref } from './link-utils'

it.each([
  ['https://example.com', 'https://example.com'],
  ['https://example.com/a/', 'https://example.com/a/'],
  ['example.com/path', 'https://example.com/path'],
  ['mailto:jana@example.com', 'mailto:jana@example.com'],
  ['/about', '/about'],
  ['#section', '#section'],
])('%s becomes %s', (input, output) => {
  expect(safeHref(input)).toBe(output)
})

it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,hi', 'vbscript:x', '//evil.test', ''])('refuses %j', (input) => {
  expect(safeHref(input)).toBeNull()
})
