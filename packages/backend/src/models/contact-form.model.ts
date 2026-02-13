import mongoose, { Schema, Document } from 'mongoose';

/**
 * Form field types
 */
export enum FormFieldType {
  TEXT = 'TEXT',
  EMAIL = 'EMAIL',
  TEXTAREA = 'TEXTAREA',
  SELECT = 'SELECT',
  NUMBER = 'NUMBER',
  CHECKBOX = 'CHECKBOX',
  DATE = 'DATE',
}

/**
 * Form field definition
 */
export interface FormField {
  name: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Contact Form document interface
 */
export interface IContactForm extends Document {
  name: string;
  slug: string;
  description?: string;
  fields: FormField[];
  recipientEmail: string;
  siteId?: mongoose.Types.ObjectId;
  isActive: boolean;
  submissionCount: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FormFieldSchema = new Schema<FormField>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: Object.values(FormFieldType) },
    label: { type: String, required: true, trim: true },
    placeholder: { type: String, trim: true },
    required: { type: Boolean, default: false },
    options: [String],
    validation: {
      minLength: Number,
      maxLength: Number,
      min: Number,
      max: Number,
      pattern: String,
    },
  },
  { _id: false }
);

const ContactFormSchema = new Schema<IContactForm>(
  {
    name: {
      type: String,
      required: [true, 'Form name is required'],
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
      type: [FormFieldSchema],
      required: [true, 'At least one field is required'],
      validate: {
        validator: function (fields: FormField[]) {
          return fields.length > 0;
        },
        message: 'Contact form must have at least one field',
      },
    },
    recipientEmail: {
      type: String,
      required: [true, 'Recipient email is required'],
      trim: true,
    },
    siteId: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    submissionCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
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

// Indexes
ContactFormSchema.index({ slug: 1 }, { unique: true });
ContactFormSchema.index({ isActive: 1 });
ContactFormSchema.index({ createdAt: -1 });

// Validate field names are unique within a form
ContactFormSchema.pre('save', function (next) {
  const fieldNames = this.fields.map((f) => f.name);
  const uniqueFieldNames = new Set(fieldNames);

  if (fieldNames.length !== uniqueFieldNames.size) {
    const error = new Error('Field names must be unique within a contact form');
    return next(error);
  }

  next();
});

export const ContactFormModel = mongoose.model<IContactForm>('ContactForm', ContactFormSchema);
