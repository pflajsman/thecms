import mongoose, { Schema, Document } from 'mongoose';

/**
 * Media document interface for Mongoose
 */
export interface IMedia extends Document {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  blobUrl: string;
  cdnUrl?: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  variants?: MediaVariant[];
  uploadedBy?: mongoose.Types.ObjectId;
  tags?: string[];
  altText?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Media variant (different sizes/formats)
 */
export interface MediaVariant {
  name: string; // e.g., 'thumbnail', 'small', 'medium', 'large'
  width: number;
  height: number;
  url: string;
  size: number;
}

/**
 * Media Variant Schema
 */
const MediaVariantSchema = new Schema<MediaVariant>(
  {
    name: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
      required: true,
    },
    height: {
      type: Number,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Media Schema
 */
const MediaSchema = new Schema<IMedia>(
  {
    filename: {
      type: String,
      required: [true, 'Filename is required'],
      trim: true,
    },
    originalName: {
      type: String,
      required: [true, 'Original name is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      index: true,
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size must be positive'],
    },
    blobUrl: {
      type: String,
      required: [true, 'Blob URL is required'],
    },
    cdnUrl: {
      type: String,
    },
    width: {
      type: Number,
      min: 0,
    },
    height: {
      type: Number,
      min: 0,
    },
    thumbnailUrl: {
      type: String,
    },
    variants: {
      type: [MediaVariantSchema],
      default: [],
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    altText: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be less than 500 characters'],
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

// Indexes for efficient queries
MediaSchema.index({ mimeType: 1, createdAt: -1 });
MediaSchema.index({ uploadedBy: 1, createdAt: -1 });
MediaSchema.index({ tags: 1 });
MediaSchema.index({ createdAt: -1 });

// Text index for searching by filename, altText, description
MediaSchema.index({
  filename: 'text',
  originalName: 'text',
  altText: 'text',
  description: 'text',
  tags: 'text',
});

/**
 * Helper method to check if media is an image
 */
MediaSchema.methods.isImage = function (): boolean {
  return this.mimeType.startsWith('image/');
};

/**
 * Helper method to check if media is a video
 */
MediaSchema.methods.isVideo = function (): boolean {
  return this.mimeType.startsWith('video/');
};

/**
 * Helper method to check if media is a document
 */
MediaSchema.methods.isDocument = function (): boolean {
  return (
    this.mimeType.includes('pdf') ||
    this.mimeType.includes('document') ||
    this.mimeType.includes('sheet') ||
    this.mimeType.includes('presentation')
  );
};

/**
 * Media Model
 */
export const MediaModel = mongoose.model<IMedia>('Media', MediaSchema);
