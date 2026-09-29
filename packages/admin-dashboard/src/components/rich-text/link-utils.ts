/** Allowed link targets: http(s), mailto, page paths and anchors. Bare domains get https://. */
export function safeHref(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (value.startsWith('#') || (value.startsWith('/') && !value.startsWith('//'))) return value
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(value)) return value
  if (/^https?:\/\//i.test(value)) {
    try {
      new URL(value)
      return value
    } catch {
      return null
    }
  }
  // Any other scheme (javascript:, data:, vbscript:, ...) is refused.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) return `https://${value}`
  return null
}
