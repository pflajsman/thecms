import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Paths are relative to the package root; Vitest runs from there.
const scope: { files: string[] } = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n-scope.json'), 'utf8'))

// The lint rule covers JSX text and attributes; toasts are plain calls, so check them here.
// Whitespace (including newlines) may sit between the call and its first argument.
const RAW_TOAST = /\btoast(?:\.(?:success|error|info|warning|message))?\(\s*(['"`])[^'"`]*[A-Za-z]/g

/** Toast calls whose first argument is literal text, with the 1-based line where each call starts. */
function findRawToasts(text: string): string[] {
  return [...text.matchAll(RAW_TOAST)].map((m) => {
    const line = text.slice(0, m.index).split('\n').length
    return `${line}: ${m[0].replace(/\s+/g, ' ')}`
  })
}

it('finds literal toast text, also when the text starts on the next line', () => {
  expect(findRawToasts("toast.success('Saved')")).toHaveLength(1)
  expect(findRawToasts("toast.error(\n  'Could not save',\n)")).toHaveLength(1)
  expect(findRawToasts("toast.success(t('toast.saved'))")).toEqual([])
})

it.each(scope.files.length ? scope.files : ['(none yet)'])('%s passes no literal text to toast', (file) => {
  if (file === '(none yet)') return
  expect(findRawToasts(readFileSync(resolve(process.cwd(), file), 'utf8'))).toEqual([])
})
