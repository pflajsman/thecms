import type { RouteObject } from 'react-router-dom'
import type { AppModule } from './types'

/** True when pathname is prefix itself or a child segment of it. '/' matches only itself. */
export function pathMatches(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isModuleActive(module: Pick<AppModule, 'path' | 'matches'>, pathname: string): boolean {
  return [module.path, ...(module.matches ?? [])].some((prefix) => pathMatches(pathname, prefix))
}

export function findActiveModule<T extends Pick<AppModule, 'path' | 'matches'>>(modules: T[], pathname: string): T | undefined {
  return modules.find((m) => isModuleActive(m, pathname))
}

export function groupModules<T extends Pick<AppModule, 'group'>>(modules: T[]): { workspace: T[]; setup: T[] } {
  return {
    workspace: modules.filter((m) => m.group === 'workspace'),
    setup: modules.filter((m) => m.group === 'setup'),
  }
}

export function mobileTabModules<T extends Pick<AppModule, 'mobileTab'>>(modules: T[]): T[] {
  return modules.filter((m) => m.mobileTab)
}

export function collectRoutes(modules: Pick<AppModule, 'routes'>[]): RouteObject[] {
  return modules.flatMap((m) => m.routes)
}
