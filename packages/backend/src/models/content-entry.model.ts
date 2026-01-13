import mongoose, { Schema, Document } from 'mongoose';

/**
 * Content Entry status enum
 */
export enum ContentStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Content Entry document interface for Mongoose
 */
export interface IContentEntry extends Document {
  contentTypeId: mongoose.Types.ObjectId;
  data: Record<string, any>;
  status: ContentStatus;
  publishedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Content Entry Schema
 */
const ContentEntrySchema = new Schema<IContentEntry>(
  {
    contentTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentType',
      required: [true, 'Content type is required'],
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: [true, 'Content data is required'],
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(ContentStatus),
      default: ContentStatus.DRAFT,
      required: true,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return {
          id: _id.toString(),
          ...rest,
        };
      },
    },
  }
);

// Compound indexes for efficient queries
ContentEntrySchema.index({ contentTypeId: 1, status: 1 });
ContentEntrySchema.index({ contentTypeId: 1, createdAt: -1 });
ContentEntrySchema.index({ contentTypeId: 1, publishedAt: -1 });
ContentEntrySchema.index({ status: 1, publishedAt: -1 });

// Text index for full-text search on data fields
// Note: Wildcard text index is created manually in sync-indexes.ts script
// due to issues with Mongoose's syncIndexes() and wildcard syntax

// Pre-save middleware to set publishedAt timestamp
ContentEntrySchema.pre('save', function (next) {
  // If status is changing to PUBLISHED and publishedAt is not set
  if (this.isModified('status') && this.status === ContentStatus.PUBLISHED && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // If status is changing from PUBLISHED to DRAFT, clear publishedAt
  if (
    this.isModified('status') &&
    this.status === ContentStatus.DRAFT &&
    this.publishedAt
  ) {
    this.publishedAt = undefined;
  }

  next();
});

/**
 * Content Entry Model
 */
export const ContentEntryModel = mongoose.model<IContentEntry>(
  'ContentEntry',
  ContentEntrySchema
);
