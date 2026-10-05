import type { LucideIcon } from 'lucide-react'
import type { RouteObject } from 'react-router-dom'
import type shellEn from '@/i18n/locales/en/shell.json'
import type { Capability } from '@/features/projects/project-roles'

export type NavLabelKey = `nav.${keyof typeof shellEn.nav & string}`
export type CreateLabelKey = `create.${keyof typeof shellEn.create & string}`

export type ModuleGroup = 'workspace' | 'commerce' | 'setup'

export interface AppModule {
  id: string
  labelKey: NavLabelKey
  icon: LucideIcon
  group: ModuleGroup
  /** Canonical path shown in navigation. */
  path: string
  routes: RouteObject[]
  /** Shown in the mobile bottom tab bar. */
  mobileTab?: boolean
  /** Extra path prefixes (legacy URLs) that mark this module active. */
  matches?: string[]
  /** Hook returning a badge count, e.g. unread messages. */
  useBadge?: () => number | undefined
  /** Shown only to roles with this capability in the current project. */
  capability?: Capability
}

export interface CreateAction {
  id: string
  labelKey: CreateLabelKey
  to: string
  icon: LucideIcon
  capability?: Capability
}
