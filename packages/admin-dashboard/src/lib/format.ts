import { differenceInCalendarDays, format } from 'date-fns'
import { cs } from 'date-fns/locale'
import { i18n } from '@/i18n'

/** Initials for an avatar: first letter of the first and last word. */
export function getInitials(name?: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

function lang(): 'en' | 'cs' {
  return i18n.language === 'cs' ? 'cs' : 'en'
}

const PATTERNS = {
  en: { day: 'd MMM yyyy', dateTime: 'd MMM yyyy, HH:mm' },
  cs: { day: 'd. MMMM yyyy', dateTime: 'd. M. yyyy, HH:mm' },
} as const

function localeOptions() {
  return lang() === 'cs' ? { locale: cs } : {}
}

/** Short relative time for lists: "just now", "45m ago", "3h ago", "yesterday", "4 days ago", else the date. */
export function formatRelative(date: string | Date, now: Date = new Date()): string {
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (seconds < 60) return i18n.t('time.justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return i18n.t('time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24 && differenceInCalendarDays(now, then) === 0) return i18n.t('time.hoursAgo', { count: hours })
  const days = differenceInCalendarDays(now, then)
  if (days <= 1) return i18n.t('time.yesterday')
  if (days < 7) return i18n.t('time.daysAgo', { count: days })
  return formatDate(then)
}

/** Day only: "1 Aug 2026" / "1. srpna 2026". */
export function formatDate(date: string | Date): string {
  return format(new Date(date), PATTERNS[lang()].day, localeOptions())
}

/** Day and time: "1 Aug 2026, 14:05" / "1. 8. 2026, 14:05". */
export function formatAbsolute(date: string | Date): string {
  return format(new Date(date), PATTERNS[lang()].dateTime, localeOptions())
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(lang() === 'cs' ? 'cs-CZ' : 'en-US', options).format(value)
}
