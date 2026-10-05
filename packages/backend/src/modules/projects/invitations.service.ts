import crypto from 'crypto';
import { Types } from 'mongoose';
import { AppError } from '../../middleware/error.middleware';
import { adminUrl } from '../../config/auth';
import { InvitationModel, type IInvitation } from '../../models/invitation.model';
import { ProjectModel } from '../../models/project.model';
import { ProjectRole } from '../../models/project-member.model';
import { User } from '../../models/user.model';
import { hashToken } from '../tokens/tokens.service';
import { assertCanManage, MembersService, type Actor } from './members.service';
import { sendInviteEmail, type InviteLanguage } from './invite-email';

export const MAX_OPEN_INVITATIONS = 50;
const INVITE_TTL_MS = 7 * 86_400_000;

export interface InvitationItem {
  id: string;
  email: string;
  role: ProjectRole;
  expiresAt: Date;
  expired: boolean;
  createdAt: Date;
}

export interface CreatedInvitation {
  invitation: InvitationItem;
  inviteUrl: string;
  emailSent: boolean;
}

const toItem = (i: IInvitation): InvitationItem => ({
  id: String(i._id),
  email: i.email,
  role: i.role,
  expiresAt: i.expiresAt,
  expired: i.expiresAt.getTime() <= Date.now(),
  createdAt: i.createdAt,
});

const newToken = () => crypto.randomBytes(32).toString('base64url');
const inviteUrl = (token: string) => `${adminUrl()}/invite/${token}`;

async function inviterName(entraId: string): Promise<string> {
  const user = await User.findOne({ entraId }).lean();
  return user?.displayName || user?.email || 'TheCMS';
}

/** Gives the invitation a fresh token and expiry and emails the link. */
async function issue(invitation: IInvitation, language: InviteLanguage): Promise<CreatedInvitation> {
  const token = newToken();
  invitation.tokenHash = hashToken(token);
  invitation.expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await invitation.save();
  const project = await ProjectModel.findById(invitation.projectId).lean();
  const emailSent = await sendInviteEmail({
    to: invitation.email,
    projectName: project?.name ?? '',
    inviterName: await inviterName(invitation.invitedBy),
    role: invitation.role,
    url: inviteUrl(token),
    language,
  });
  return { invitation: toItem(invitation), inviteUrl: inviteUrl(token), emailSent };
}

async function findOpen(projectId: string, id: string) {
  const invitation = Types.ObjectId.isValid(id) ? await InvitationModel.findOne({ _id: id, projectId, acceptedAt: null }) : null;
  if (!invitation) throw new AppError('Invitation not found', 404);
  return invitation;
}

async function findByToken(token: string) {
  const invitation = await InvitationModel.findOne({ tokenHash: hashToken(token) });
  const project = invitation ? await ProjectModel.findById(invitation.projectId).lean() : null;
  if (!invitation || !project || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now() || project.status !== 'active') {
    throw new AppError('This invitation is no longer valid', 410, { reason: 'INVITATION_INVALID' });
  }
  return { invitation, project };
}

export const InvitationsService = {
  /** Open invitations, newest first. Sorted here: Cosmos DB needs an index for every sort. */
  async list(projectId: string): Promise<InvitationItem[]> {
    const open = await InvitationModel.find({ projectId, acceptedAt: null });
    return open.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toItem);
  },

  /** Invites an email; an open invitation for the same email is reissued with the new role. */
  async create(projectId: string, actor: Actor, input: { email: string; role: ProjectRole; language: InviteLanguage }): Promise<CreatedInvitation> {
    assertCanManage(actor, undefined, input.role);
    const email = input.email.trim().toLowerCase();
    let invitation = await InvitationModel.findOne({ projectId, email, acceptedAt: null });
    if (invitation) {
      invitation.role = input.role;
      invitation.invitedBy = actor.userId;
    } else {
      if ((await InvitationModel.countDocuments({ projectId, acceptedAt: null })) >= MAX_OPEN_INVITATIONS) {
        throw new AppError(`A project can have at most ${MAX_OPEN_INVITATIONS} open invitations`, 409, { reason: 'INVITATION_LIMIT' });
      }
      invitation = new InvitationModel({ projectId, email, role: input.role, invitedBy: actor.userId, tokenHash: hashToken(newToken()), expiresAt: new Date() });
    }
    return issue(invitation, input.language);
  },

  async resend(projectId: string, actor: Actor, id: string, language: InviteLanguage): Promise<CreatedInvitation> {
    const invitation = await findOpen(projectId, id);
    assertCanManage(actor, undefined, invitation.role);
    return issue(invitation, language);
  },

  async revoke(projectId: string, actor: Actor, id: string): Promise<void> {
    const invitation = await findOpen(projectId, id);
    assertCanManage(actor, undefined, invitation.role);
    await invitation.deleteOne();
  },

  /** What the invite page shows before accepting. */
  async preview(token: string): Promise<{ projectName: string; role: ProjectRole; invitedByName: string }> {
    const { invitation, project } = await findByToken(token);
    return { projectName: project.name, role: invitation.role, invitedByName: await inviterName(invitation.invitedBy) };
  },

  /** Makes the signed-in caller a member; the link then stops working. */
  async accept(token: string, userId: string): Promise<{ projectId: string }> {
    const { invitation, project } = await findByToken(token);
    // Claim the invitation first, so two tabs cannot both use it.
    const claimed = await InvitationModel.updateOne(
      { _id: invitation._id, acceptedAt: null },
      { $set: { acceptedAt: new Date(), acceptedBy: userId } }
    );
    if (claimed.modifiedCount === 0) throw new AppError('This invitation is no longer valid', 410, { reason: 'INVITATION_INVALID' });
    await MembersService.grant(String(project._id), userId, invitation.role);
    return { projectId: String(project._id) };
  },
};
