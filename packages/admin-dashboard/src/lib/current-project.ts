const STORAGE_KEY = 'current_project'

// Read on every API request, so it lives outside React. ProjectProvider keeps it in step with the UI.
let current: string | null = readStored()

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** The project the admin is working in, sent as X-Project-Id. */
export function getCurrentProjectId(): string | null {
  return current
}

/** The last project the user chose on this device, if any. */
export function getStoredProjectId(): string | null {
  return readStored()
}

export function setCurrentProjectId(id: string | null): void {
  current = id
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: the choice lasts for this tab only.
  }
}

/** Headers that scope a request to the current project. */
export function projectHeaders(): Record<string, string> {
  return current ? { 'X-Project-Id': current } : {}
}
