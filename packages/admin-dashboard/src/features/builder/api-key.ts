import { i18n } from '@/i18n'
export const API_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/
const MAX_KEY = 50

function asciiWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/** "GPX track" -> "gpxTrack", "Distance (km)" -> "distanceKm". */
export function toApiKey(label: string): string {
  const words = asciiWords(label)
  if (words.length === 0) return ''
  let key = words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
  if (/^[0-9]/.test(key)) key = `field${key.charAt(0).toUpperCase()}${key.slice(1)}`
  return key.slice(0, MAX_KEY)
}

export function uniqueKey(base: string, taken: string[]): string {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}${n}`)) n += 1
  return `${base}${n}`
}

export function toSlug(name: string): string {
  return asciiWords(name).join('-').toLowerCase().slice(0, 100)
}

export function apiKeyError(key: string, otherKeys: string[]): string | null {
  if (!key) return i18n.t('builder:key.required')
  if (key.length > MAX_KEY || !API_KEY_PATTERN.test(key)) return i18n.t('builder:key.pattern')
  if (otherKeys.includes(key)) return i18n.t('builder:key.taken')
  return null
}
