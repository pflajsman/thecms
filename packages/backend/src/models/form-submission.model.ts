import mongoose, { Schema, Document } from 'mongoose';

/**
 * Submission status
 */
export enum SubmissionStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

/**
 * Form Submission document interface
 */
export interface IFormSubmission extends Document {
  formId: mongoose.Types.ObjectId;
  data: Record<string, any>;
  status: SubmissionStatus;
  submitterIp?: string;
  submitterUserAgent?: string;
  emailSent: boolean;
  emailError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FormSubmissionSchema = new Schema<IFormSubmission>(
  {
    formId: {
      type: Schema.Types.ObjectId,
      ref: 'ContactForm',
      required: [true, 'Form ID is required'],
    },
    data: {
      type: Schema.Types.Mixed,
      required: [true, 'Submission data is required'],
    },
    status: {
      type: String,
      enum: Object.values(SubmissionStatus),
      default: SubmissionStatus.UNREAD,
    },
    submitterIp: String,
    submitterUserAgent: String,
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailError: String,
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
FormSubmissionSchema.index({ formId: 1, status: 1 });
FormSubmissionSchema.index({ formId: 1, createdAt: -1 });

export const FormSubmissionModel = mongoose.model<IFormSubmission>('FormSubmission', FormSubmissionSchema);
