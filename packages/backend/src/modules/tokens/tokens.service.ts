import crypto from 'crypto';
import mongoose from 'mongoose';
import { AccessTokenModel, type IAccessToken } from '../../models/access-token.model';
import { User } from '../../models/user.model';
import { ProjectModel } from '../../models/project.model';
import { ProjectMemberModel, ProjectRole } from '../../models/project-member.model';
import { AppError } from '../../middleware/error.middleware';

export const TOKEN_PREFIX = 'tcms_pat_';
export const MAX_TOKENS = 10;
const DAY_MS = 86_400_000;
const LAST_USED_EVERY_MS = 60_000;

export interface TokenListItem {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  expired: boolean;
}

export interface ResolvedToken {
  tokenId: string;
  prefix: string;
  /** The project the token works in, and the owner's current role there. */
  projectId: string;
  role: ProjectRole;
  user: { entraId: string; email: string; displayName?: string };
}

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const isExpired = (t: Pick<IAccessToken, 'expiresAt'>, now = Date.now()) => !!t.expiresAt && t.expiresAt.getTime() <= now;

function toItem(t: IAccessToken): TokenListItem {
  return {
    id: String(t._id),
    name: t.name,
    prefix: t.prefix,
    createdAt: t.createdAt,
    ...(t.lastUsedAt ? { lastUsedAt: t.lastUsedAt } : {}),
    ...(t.expiresAt ? { expiresAt: t.expiresAt } : {}),
    expired: isExpired(t),
  };
}

export const TokensService = {
  /** The caller's tokens for the project, newest first. Sorted here: a user has at most a few, and Cosmos DB needs an index for every sort. */
  async list(userId: string, projectId: string): Promise<TokenListItem[]> {
    const tokens = await AccessTokenModel.find({ userId, projectId });
    return tokens.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toItem);
  },

  /** A token for one project. The limit counts the user's tokens across all projects. */
  async create(userId: string, projectId: string, input: { name: string; expiresInDays?: number }): Promise<TokenListItem & { token: string }> {
    const tokens = await AccessTokenModel.find({ userId }).select('expiresAt').lean();
    if (tokens.filter((t) => !isExpired(t)).length >= MAX_TOKENS) {
      throw new AppError(`You have ${MAX_TOKENS} tokens. Revoke one to create another.`, 409, { reason: 'TOKEN_LIMIT' });
    }
    const token = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
    const doc = await AccessTokenModel.create({
      userId,
      projectId,
      name: input.name,
      hash: hashToken(token),
      prefix: token.slice(0, 12),
      ...(input.expiresInDays ? { expiresAt: new Date(Date.now() + input.expiresInDays * DAY_MS) } : {}),
    });
    return { token, ...toItem(doc) };
  },

  async revoke(userId: string, projectId: string, id: string): Promise<void> {
    const found = mongoose.Types.ObjectId.isValid(id) ? await AccessTokenModel.deleteOne({ _id: id, userId, projectId }) : { deletedCount: 0 };
    if (!found.deletedCount) throw new AppError('Token not found', 404);
  },

  /**
   * The owner of a valid token and their current role in the token's project, or null when the token is unknown or
   * expired, the owner is gone, or the owner is no longer in an active project. Records the last use at most once a minute.
   */
  async resolve(token: string): Promise<ResolvedToken | null> {
    if (!token.startsWith(TOKEN_PREFIX)) return null;
    const doc = await AccessTokenModel.findOne({ hash: hashToken(token) });
    if (!doc || isExpired(doc) || !doc.projectId) return null;
    const [user, project, member] = await Promise.all([
      User.findOne({ entraId: doc.userId }).lean(),
      ProjectModel.findById(doc.projectId).lean(),
      ProjectMemberModel.findOne({ projectId: doc.projectId, userId: doc.userId }).lean(),
    ]);
    if (!user || !project || project.status !== 'active') return null;
    const role = user.isSuperadmin ? ProjectRole.OWNER : member?.role;
    if (!role) return null;
    if (!doc.lastUsedAt || Date.now() - doc.lastUsedAt.getTime() > LAST_USED_EVERY_MS) {
      await AccessTokenModel.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } });
    }
    return {
      tokenId: String(doc._id),
      prefix: doc.prefix,
      projectId: String(doc.projectId),
      role,
      user: { entraId: user.entraId, email: user.email, displayName: user.displayName },
    };
  },
};
