export interface SitePayload {
  name: string
  domain: string
  description?: string
  allowedOrigins: string[]
  isActive?: boolean
}

const ORIGIN_HINT = 'Enter a full URL, for example https://example.com'

export function maskKey(key: string): string {
  if (key.length <= 12) return '•'.repeat(key.length)
  const prefix = key.includes('_') ? key.slice(0, key.indexOf('_') + 1) : ''
  return `${prefix}${'•'.repeat(8)}${key.slice(-4)}`
}

export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function originError(value: string, existing: string[]): string | null {
  const v = normalizeOrigin(value)
  if (!isHttpUrl(v)) return ORIGIN_HINT
  if (existing.map(normalizeOrigin).includes(v)) return 'This origin is already in the list'
  return null
}

export function validateSite(d: SitePayload): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!d.name.trim()) errors.name = 'Name is required'
  if (!d.domain.trim()) errors.domain = 'Domain is required'
  if (d.allowedOrigins.some((o) => !isHttpUrl(normalizeOrigin(o)))) errors.allowedOrigins = ORIGIN_HINT
  return errors
}
