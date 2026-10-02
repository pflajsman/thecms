import mongoose, { Schema, type Document } from 'mongoose';

/** A personal access token for MCP. Only the hash is stored; the token is shown once. */
export interface IAccessToken extends Document {
  userId: string;
  name: string;
  hash: string;
  prefix: string;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

const AccessTokenSchema = new Schema<IAccessToken>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    hash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    expiresAt: { type: Date },
    lastUsedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const AccessTokenModel = mongoose.model<IAccessToken>('AccessToken', AccessTokenSchema);
