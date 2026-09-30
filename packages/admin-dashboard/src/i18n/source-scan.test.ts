import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Paths are relative to the package root; Vitest runs from there.
const scope: { files: string[] } = JSON.parse(readFileSync(resolve(process.cwd(), 'i18n-scope.json'), 'utf8'))

// The lint rule covers JSX text and attributes; toasts are plain calls, so check them here.
const RAW_TOAST = /\btoast(?:\.(?:success|error|info|warning|message))?\(\s*(['"`])[^'"`]*[A-Za-z]/

it.each(scope.files.length ? scope.files : ['(none yet)'])('%s passes no literal text to toast', (file) => {
  if (file === '(none yet)') return
  const lines = readFileSync(resolve(process.cwd(), file), 'utf8').split('\n')
  const offenders = lines.map((l, i) => (RAW_TOAST.test(l) ? `${i + 1}: ${l.trim()}` : null)).filter(Boolean)
  expect(offenders).toEqual([])
})
