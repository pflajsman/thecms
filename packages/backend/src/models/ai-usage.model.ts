import mongoose, { Schema } from 'mongoose';

export interface IAiUsage {
  userId: string;
  /** 'YYYY-MM' in UTC. */
  month: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

const AiUsageSchema = new Schema<IAiUsage>({
  userId: { type: String, required: true },
  month: { type: String, required: true },
  requests: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
});
AiUsageSchema.index({ userId: 1, month: 1 }, { unique: true });

export const AiUsageModel = mongoose.model<IAiUsage>('AiUsage', AiUsageSchema);
