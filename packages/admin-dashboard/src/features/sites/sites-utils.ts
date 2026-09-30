import { i18n } from '@/i18n'
export interface SitePayload {
  name: string
  domain: string
  description?: string
  allowedOrigins: string[]
  isActive?: boolean
}


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
  if (!isHttpUrl(v)) return i18n.t('sites:validation.origin')
  if (existing.map(normalizeOrigin).includes(v)) return i18n.t('sites:validation.originDuplicate')
  return null
}

export function validateSite(d: SitePayload): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!d.name.trim()) errors.name = i18n.t('sites:validation.nameRequired')
  if (!d.domain.trim()) errors.domain = i18n.t('sites:validation.domainRequired')
  if (d.allowedOrigins.some((o) => !isHttpUrl(normalizeOrigin(o)))) errors.allowedOrigins = i18n.t('sites:validation.origin')
  return errors
}
