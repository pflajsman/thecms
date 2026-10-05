import { i18n } from '@/i18n'
import type { DashboardStats } from '@/types'
import { getCurrentProjectId } from '@/lib/current-project'

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
    { id: 'signin', title: i18n.t('home:setup.signin.title'), description: i18n.t('home:setup.signin.description'), done: true },
    { id: 'model', title: i18n.t('home:setup.model.title'), description: i18n.t('home:setup.model.description'), done: stats.contentTypes > 0, to: '/models/new', cta: i18n.t('home:setup.model.cta') },
    { id: 'entry', title: i18n.t('home:setup.entry.title'), description: i18n.t('home:setup.entry.description'), done: stats.entries.total > 0, to: '/content/new', cta: i18n.t('home:setup.entry.cta') },
    { id: 'site', title: i18n.t('home:setup.site.title'), description: i18n.t('home:setup.site.description'), done: stats.sites > 0, to: '/sites/new', cta: i18n.t('home:setup.site.cta') },
  ]
}

export function greeting(date: Date, name?: string): string {
  const hour = date.getHours()
  const part = i18n.t(hour < 12 ? 'home:greeting.morning' : hour < 18 ? 'home:greeting.afternoon' : 'home:greeting.evening')
  const first = name?.trim().split(/\s+/)[0]
  return first ? i18n.t('home:greeting.withName', { greeting: part, name: first }) : part
}

export function publicApiBase(): string {
  const admin = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api/v1'
  return `${admin.replace(/\/$/, '')}/public`
}

// Per project: each project has its own setup to finish.
const dismissKey = () => `thecms-setup-dismissed:${getCurrentProjectId() ?? ''}`

export function readSetupDismissed(): boolean {
  try {
    return window.localStorage.getItem(dismissKey()) === '1'
  } catch {
    return false
  }
}

export function writeSetupDismissed(): void {
  try {
    window.localStorage.setItem(dismissKey(), '1')
  } catch {
    // Storage unavailable: the guide simply stays hidden for this visit.
  }
}
