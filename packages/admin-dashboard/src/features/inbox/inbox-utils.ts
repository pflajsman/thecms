import type { SubmissionStatus } from '@/types'
import type { InboxItem, InboxView } from './inbox-api'

function text(value: unknown): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export function displayFields(item: InboxItem): { label: string; value: string }[] {
  const known = item.form?.fields ?? []
  const rows = known.filter((f) => f.name in item.data).map((f) => ({ label: f.label, value: text(item.data[f.name]) }))
  const extra = Object.keys(item.data).filter((k) => !known.some((f) => f.name === k)).map((k) => ({ label: k, value: text(item.data[k]) }))
  return [...rows, ...extra]
}

export function replyAddress(item: InboxItem): string | undefined {
  const emailField = item.form?.fields.find((f) => f.type === 'EMAIL')?.name
  const value = emailField ? item.data[emailField] : item.data.email
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : undefined
}

export function senderName(item: InboxItem): string {
  const name = item.data.name ?? item.data.fullName
  if (typeof name === 'string' && name.trim()) return name.trim()
  return replyAddress(item) ?? 'Anonymous'
}

export function preview(item: InboxItem): string {
  const values = Object.values(item.data).filter((v): v is string => typeof v === 'string')
  const longest = values.sort((a, b) => b.length - a.length)[0] ?? ''
  return longest.length > 140 ? `${longest.slice(0, 140)}…` : longest
}

export function viewStatus(view: InboxView): SubmissionStatus | undefined {
  return view === 'unread' ? 'UNREAD' : view === 'archived' ? 'ARCHIVED' : undefined
}
