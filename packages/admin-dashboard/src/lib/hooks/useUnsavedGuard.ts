import { useEffect } from 'react'
import { useBlocker, type Blocker } from 'react-router-dom'

/** Blocks in-app navigation and tab close while `when` is true. Navigations with state.skipGuard pass. */
export function useUnsavedGuard(when: boolean): Blocker {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const skip = (nextLocation.state as { skipGuard?: boolean } | null)?.skipGuard === true
    return when && !skip && currentLocation.pathname !== nextLocation.pathname
  })

  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])

  return blocker
}
