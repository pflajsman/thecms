import mongoose, { Document, Schema } from 'mongoose';

export type AiProviderName = 'anthropic' | 'openai-compatible';
export const AI_PROVIDERS: AiProviderName[] = ['anthropic', 'openai-compatible'];

export interface StoredKey {
  iv: string;
  tag: string;
  data: string;
}

export interface IAiConnection extends Document {
  /** Entra id of the user who owns this connection. */
  userId: string;
  provider: AiProviderName;
  model: string;
  baseUrl?: string;
  key?: StoredKey;
  keyHint?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KeySchema = new Schema<StoredKey>({ iv: String, tag: String, data: String }, { _id: false });

const AiConnectionSchema = new Schema<IAiConnection>(
  {
    userId: { type: String, required: true, unique: true },
    provider: { type: String, enum: AI_PROVIDERS, required: true },
    model: { type: String, required: true },
    baseUrl: { type: String },
    key: { type: KeySchema, required: false },
    keyHint: { type: String },
  },
  { timestamps: true }
);

export const AiConnectionModel = mongoose.model<IAiConnection>('AiConnection', AiConnectionSchema);
