import { useEffect, useRef } from 'react'

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

interface HotkeyOptions {
  /** Require ⌘ (macOS) or Ctrl. */
  mod?: boolean
  allowInInputs?: boolean
}

export function useHotkey(key: string, handler: (event: KeyboardEvent) => void, { mod = false, allowInInputs = false }: HotkeyOptions = {}) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (typeof event.key !== 'string' || event.key.toLowerCase() !== key) return
      if (mod !== (event.metaKey || event.ctrlKey)) return
      if (!allowInInputs && isTypingTarget(event.target)) return
      handlerRef.current(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, mod, allowInInputs])
}
