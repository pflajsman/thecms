import { useCallback, useEffect, useRef } from 'react'

interface AutosaveOptions {
  /** False for published and archived entries. */
  enabled: boolean
  isDirty: boolean
  isValid: boolean
  /** Changes whenever the values change; restarts the timer. */
  changeKey: string
  save: () => Promise<unknown>
  delay?: number
}

export function useAutosave({ enabled, isDirty, isValid, changeKey, save, delay = 2000 }: AutosaveOptions) {
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  const ready = enabled && isDirty && isValid

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      void saveRef.current()
    }, delay)
    return () => clearTimeout(timer)
  }, [ready, changeKey, delay])

  const flush = useCallback(() => {
    if (ready) void saveRef.current()
  }, [ready])

  return { flush }
}
