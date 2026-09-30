import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Field } from '@/types'
import { validateEntry, type EntryValues } from '@/lib/entry-schema'

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return `{${Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

export function useEntryForm(fields: Field[], initial: EntryValues) {
  const [values, setValues] = useState<EntryValues>(initial)
  const [baseline, setBaseline] = useState<EntryValues>(initial)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [revealAll, setRevealAll] = useState(false)

  // Messages are built in the current language, so a language switch must rebuild them.
  const { i18n } = useTranslation()
  const language = i18n.language
  const errors = useMemo(() => validateEntry(fields, values, language), [fields, values, language])
  const changeKey = useMemo(() => stableStringify(values), [values])
  const isDirty = useMemo(() => changeKey !== stableStringify(baseline), [changeKey, baseline])
  const visibleErrors = useMemo(
    () => (revealAll ? errors : Object.fromEntries(Object.entries(errors).filter(([name]) => touched[name]))),
    [errors, touched, revealAll],
  )

  const setValue = useCallback((name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value })), [])
  const touch = useCallback((name: string) => setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true })), [])
  const showAllErrors = useCallback(() => setRevealAll(true), [])
  const markSaved = useCallback((saved: EntryValues) => setBaseline(saved), [])
  const reset = useCallback((next: EntryValues) => {
    setValues(next)
    setBaseline(next)
    setTouched({})
    setRevealAll(false)
  }, [])

  return {
    values,
    baseline,
    errors,
    visibleErrors,
    isValid: Object.keys(errors).length === 0,
    isDirty,
    changeKey,
    setValue,
    touch,
    showAllErrors,
    markSaved,
    reset,
  }
}
