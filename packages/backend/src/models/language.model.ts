import mongoose, { Schema, Document } from 'mongoose';
import { tenantScoped, type TenantFields } from './plugins/tenant-scoped';

export const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/;

/**
 * Content language document interface for Mongoose
 */
export interface ILanguage extends Document, TenantFields {
  code: string;
  name: string;
  isDefault: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const LanguageSchema = new Schema<ILanguage>(
  {
    // Unique index is safe on Cosmos DB: the collection is new and empty when it is created.
    code: { type: String, required: true, lowercase: true, trim: true, match: LANGUAGE_CODE },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    isDefault: { type: Boolean, default: false, index: true },
    // Lists sort by order; Cosmos DB needs an index for every sort.
    order: { type: Number, default: 0, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id.toString(), ...rest };
      },
    },
  }
);

// Unique per project, checked in the service: Cosmos DB cannot add a unique index to a filled collection.
LanguageSchema.index({ projectId: 1, code: 1 });
LanguageSchema.plugin(tenantScoped);

export const LanguageModel = mongoose.model<ILanguage>('Language', LanguageSchema);
