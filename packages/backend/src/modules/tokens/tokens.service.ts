import crypto from 'crypto';
import mongoose from 'mongoose';
import { AccessTokenModel, type IAccessToken } from '../../models/access-token.model';
import { User, UserRole } from '../../models/user.model';
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
  user: { entraId: string; email: string; displayName?: string; role: UserRole };
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
  /** The caller's tokens, newest first. Sorted here: a user has at most a few, and Cosmos DB needs an index for every sort. */
  async list(userId: string): Promise<TokenListItem[]> {
    const tokens = await AccessTokenModel.find({ userId });
    return tokens.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toItem);
  },

  async create(userId: string, input: { name: string; expiresInDays?: number }): Promise<TokenListItem & { token: string }> {
    const tokens = await AccessTokenModel.find({ userId }).select('expiresAt').lean();
    if (tokens.filter((t) => !isExpired(t)).length >= MAX_TOKENS) {
      throw new AppError(`You have ${MAX_TOKENS} tokens. Revoke one to create another.`, 409, { reason: 'TOKEN_LIMIT' });
    }
    const token = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
    const doc = await AccessTokenModel.create({
      userId,
      name: input.name,
      hash: hashToken(token),
      prefix: token.slice(0, 12),
      ...(input.expiresInDays ? { expiresAt: new Date(Date.now() + input.expiresInDays * DAY_MS) } : {}),
    });
    return { token, ...toItem(doc) };
  },

  async revoke(userId: string, id: string): Promise<void> {
    const found = mongoose.Types.ObjectId.isValid(id) ? await AccessTokenModel.deleteOne({ _id: id, userId }) : { deletedCount: 0 };
    if (!found.deletedCount) throw new AppError('Token not found', 404);
  },

  /** The owner of a valid token, or null. Records the last use at most once a minute. */
  async resolve(token: string): Promise<ResolvedToken | null> {
    if (!token.startsWith(TOKEN_PREFIX)) return null;
    const doc = await AccessTokenModel.findOne({ hash: hashToken(token) });
    if (!doc || isExpired(doc)) return null;
    const user = await User.findOne({ entraId: doc.userId }).lean();
    if (!user) return null;
    if (!doc.lastUsedAt || Date.now() - doc.lastUsedAt.getTime() > LAST_USED_EVERY_MS) {
      await AccessTokenModel.updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } });
    }
    return {
      tokenId: String(doc._id),
      prefix: doc.prefix,
      user: { entraId: user.entraId, email: user.email, displayName: user.displayName, role: user.role },
    };
  },
};
