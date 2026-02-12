import mongoose, { Document, Schema } from 'mongoose';

/**
 * Site Interface
 */
export interface ISite extends Document {
  name: string;
  domain: string;
  apiKey: string;
  description?: string;
  allowedOrigins?: string[];
  isActive: boolean;
  requestCount: number;
  lastRequestAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Site Schema
 */
const SiteSchema = new Schema<ISite>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
    },
    apiKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    allowedOrigins: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    requestCount: {
      type: Number,
      default: 0,
    },
    lastRequestAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
SiteSchema.index({ name: 1 });
SiteSchema.index({ domain: 1 });
SiteSchema.index({ isActive: 1, apiKey: 1 });
SiteSchema.index({ createdAt: -1 });

// Don't return apiKey in JSON by default (for security)
SiteSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Only hide apiKey in list operations, allow it in single get
    return ret;
  },
});

export const SiteModel = mongoose.model<ISite>('Site', SiteSchema);
