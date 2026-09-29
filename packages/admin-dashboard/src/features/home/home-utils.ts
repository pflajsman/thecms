import type { DashboardStats } from '@/types'

export interface SetupStep {
  id: 'signin' | 'model' | 'entry' | 'site'
  title: string
  description: string
  done: boolean
  to?: string
  cta?: string
}

export function getSetupSteps(stats: DashboardStats): SetupStep[] {
  return [
    { id: 'signin', title: 'Sign in', description: 'You are in.', done: true },
    { id: 'model', title: 'Create a content model', description: 'Define the fields your content has, for example a blog post.', done: stats.contentTypes > 0, to: '/content-types/new', cta: 'Create a model' },
    { id: 'entry', title: 'Write your first entry', description: 'Add content using your model.', done: stats.entries.total > 0, to: '/content/new', cta: 'Write an entry' },
    { id: 'site', title: 'Connect a site', description: 'Get an API key so your website can read published content.', done: stats.sites > 0, to: '/sites/new', cta: 'Connect a site' },
  ]
}

export function greeting(date: Date, name?: string): string {
  const hour = date.getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = name?.trim().split(/\s+/)[0]
  return first ? `${part}, ${first}` : part
}

export function publicApiBase(): string {
  const admin = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api/v1'
  return `${admin.replace(/\/$/, '')}/public`
}

const DISMISS_KEY = 'thecms-setup-dismissed'

export function readSetupDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function writeSetupDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // Storage unavailable: the guide simply stays hidden for this visit.
  }
}
