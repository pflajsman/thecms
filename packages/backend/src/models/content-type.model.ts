import mongoose, { Schema, Document } from 'mongoose';
import { FieldType, FieldDefinition } from '../types/field-types';

/**
 * Content Type document interface for Mongoose
 */
export interface IContentType extends Document {
  name: string;
  slug: string;
  description?: string;
  fields: FieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Field Definition Schema
 */
const FieldDefinitionSchema = new Schema<FieldDefinition>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(FieldType),
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    unique: {
      type: Boolean,
      default: false,
    },
    defaultValue: {
      type: Schema.Types.Mixed,
    },
    validation: {
      // Text validation
      minLength: Number,
      maxLength: Number,
      pattern: String,

      // Number validation
      min: Number,
      max: Number,
      integer: Boolean,

      // Date validation
      minDate: String,
      maxDate: String,

      // Media validation
      allowedMimeTypes: [String],
      maxFileSize: Number,

      // Relation validation
      targetContentType: String,
      multiple: Boolean,
    },
  },
  { _id: false }
);

/**
 * Content Type Schema
 */
const ContentTypeSchema = new Schema<IContentType>(
  {
    name: {
      type: String,
      required: [true, 'Content type name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be less than 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be less than 500 characters'],
    },
    fields: {
      type: [FieldDefinitionSchema],
      required: [true, 'At least one field is required'],
      validate: {
        validator: function (fields: FieldDefinition[]) {
          return fields.length > 0;
        },
        message: 'Content type must have at least one field',
      },
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

// Indexes
ContentTypeSchema.index({ slug: 1 }, { unique: true });
ContentTypeSchema.index({ createdAt: -1 });

// Validate field names are unique within a content type
ContentTypeSchema.pre('save', function (next) {
  const fieldNames = this.fields.map((f) => f.name);
  const uniqueFieldNames = new Set(fieldNames);

  if (fieldNames.length !== uniqueFieldNames.size) {
    const error = new Error('Field names must be unique within a content type');
    return next(error);
  }

  next();
});

/**
 * Content Type Model
 */
export const ContentTypeModel = mongoose.model<IContentType>('ContentType', ContentTypeSchema);
