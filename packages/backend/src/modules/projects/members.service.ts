import { AppError } from '../../middleware/error.middleware';
import { ProjectMemberModel, ProjectRole, hasRole } from '../../models/project-member.model';
import { User } from '../../models/user.model';

export interface MemberItem {
  userId: string;
  email: string;
  displayName?: string;
  role: ProjectRole;
  createdAt: Date;
}

export interface Actor {
  userId: string;
  role: ProjectRole;
}

/**
 * Who may set a member to a role: an Admin or Owner, never above their own role,
 * and only an Owner touches someone who is already Admin or Owner.
 */
export function assertCanManage(actor: Actor, targetRole: ProjectRole | undefined, newRole: ProjectRole | undefined): void {
  if (!hasRole(actor.role, ProjectRole.ADMIN)) throw new AppError('Insufficient permissions', 403);
  if (newRole && !hasRole(actor.role, newRole)) throw new AppError('You cannot grant a role above your own', 403);
  if (targetRole && hasRole(targetRole, ProjectRole.ADMIN) && actor.role !== ProjectRole.OWNER) {
    throw new AppError('Only an Owner can change Admins and Owners', 403);
  }
}

async function assertNotLastOwner(projectId: string, member: { role: ProjectRole }): Promise<void> {
  if (member.role !== ProjectRole.OWNER) return;
  const owners = await ProjectMemberModel.countDocuments({ projectId, role: ProjectRole.OWNER });
  if (owners <= 1) throw new AppError('A project needs at least one Owner', 409, { reason: 'LAST_OWNER' });
}

async function findMember(projectId: string, userId: string) {
  const member = await ProjectMemberModel.findOne({ projectId, userId });
  if (!member) throw new AppError('Member not found', 404);
  return member;
}

export const MembersService = {
  /** Members with their name and email, Owners first, then by email. */
  async list(projectId: string): Promise<MemberItem[]> {
    const members = await ProjectMemberModel.find({ projectId }).lean();
    const users = await User.find({ entraId: { $in: members.map((m) => m.userId) } }).lean();
    const byId = new Map(users.map((u) => [u.entraId, u]));
    const rank = (role: ProjectRole) => [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.EDITOR, ProjectRole.VIEWER].indexOf(role);
    return members
      .map((m) => ({
        userId: m.userId,
        email: byId.get(m.userId)?.email ?? '',
        ...(byId.get(m.userId)?.displayName ? { displayName: byId.get(m.userId)!.displayName } : {}),
        role: m.role,
        createdAt: m.createdAt,
      }))
      .sort((a, b) => rank(a.role) - rank(b.role) || a.email.localeCompare(b.email));
  },

  async changeRole(projectId: string, actor: Actor, userId: string, role: ProjectRole): Promise<void> {
    const member = await findMember(projectId, userId);
    assertCanManage(actor, member.role, role);
    if (member.role === role) return;
    if (role !== ProjectRole.OWNER) await assertNotLastOwner(projectId, member);
    member.role = role;
    await member.save();
  },

  /** Removes a member; anyone may remove themselves, except the last Owner. */
  async remove(projectId: string, actor: Actor, userId: string): Promise<void> {
    const member = await findMember(projectId, userId);
    if (userId !== actor.userId) assertCanManage(actor, member.role, undefined);
    await assertNotLastOwner(projectId, member);
    await member.deleteOne();
  },

  /** Adds the user, or raises their role when they already have a lower one. Never lowers it. */
  async grant(projectId: string, userId: string, role: ProjectRole): Promise<void> {
    const existing = await ProjectMemberModel.findOne({ projectId, userId });
    if (!existing) {
      await ProjectMemberModel.create({ projectId, userId, role });
    } else if (!hasRole(existing.role, role)) {
      existing.role = role;
      await existing.save();
    }
  },
};
