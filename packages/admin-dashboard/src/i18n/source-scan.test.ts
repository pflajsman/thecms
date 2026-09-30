import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Every source file except tests, the ui primitives and test helpers. Vitest runs from the package root.
const SRC = resolve(process.cwd(), 'src')
const sourceFiles = (readdirSync(SRC, { recursive: true }) as string[])
  .map((f) => f.split('\\').join('/'))
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !f.startsWith('components/ui/') && !f.startsWith('test/'))
  .map((f) => `src/${f}`)

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

it.each(sourceFiles)('%s passes no literal text to toast', (file) => {
  expect(findRawToasts(readFileSync(resolve(process.cwd(), file), 'utf8'))).toEqual([])
})
