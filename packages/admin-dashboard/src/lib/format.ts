import { differenceInCalendarDays, format } from 'date-fns'

/** Initials for an avatar: first letter of the first and last word. */
export function getInitials(name?: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/** Short relative time for lists: "just now", "45m ago", "3h ago", "yesterday", "4 days ago", else "1 Aug 2026". */
export function formatRelative(date: string | Date, now: Date = new Date()): string {
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24 && differenceInCalendarDays(now, then) === 0) return `${hours}h ago`
  const days = differenceInCalendarDays(now, then)
  if (days <= 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return format(then, 'd MMM yyyy')
}

export function formatAbsolute(date: string | Date): string {
  return format(new Date(date), 'd MMM yyyy, HH:mm')
}
