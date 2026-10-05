import type { ProjectRole } from './projects-api'

const RANK: Record<ProjectRole, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2, OWNER: 3 }

/** What the UI offers per role; the server decides the same way (spec section 4). */
export type Capability = 'editContent' | 'manageSetup' | 'manageMembers' | 'manageProject'

const MINIMUM: Record<Capability, ProjectRole> = {
  editContent: 'EDITOR',
  manageSetup: 'ADMIN',
  manageMembers: 'ADMIN',
  manageProject: 'OWNER',
}

export const hasRole = (role: ProjectRole, minimum: ProjectRole) => RANK[role] >= RANK[minimum]

export const roleCan = (role: ProjectRole | undefined, capability: Capability) => !!role && hasRole(role, MINIMUM[capability])

/** Roles the actor may hand out: never above their own. */
export const grantableRoles = (actor: ProjectRole): ProjectRole[] =>
  (['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] as ProjectRole[]).filter((r) => hasRole(actor, r))

/** Whether the actor may change or remove a member who has `target`: only an Owner touches Admins and Owners. */
export const canManageMember = (actor: ProjectRole, target: ProjectRole) =>
  hasRole(actor, 'ADMIN') && (!hasRole(target, 'ADMIN') || actor === 'OWNER')
