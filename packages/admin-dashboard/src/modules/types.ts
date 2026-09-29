import type { LucideIcon } from 'lucide-react'
import type { RouteObject } from 'react-router-dom'

export type ModuleGroup = 'workspace' | 'setup'

export interface AppModule {
  id: string
  label: string
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
}

export interface CreateAction {
  id: string
  label: string
  to: string
  icon: LucideIcon
}
