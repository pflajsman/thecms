import mongoose, { Schema, Document } from 'mongoose';

export interface IVariant extends Document {
  productId: mongoose.Types.ObjectId;
  sku: string;
  optionValues: Record<string, string>;
  prices: Record<string, number>;
  weightGrams: number;
  stock: { tracked: boolean; quantity: number };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<IVariant>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    // Unique across the shop. The collection is new, so Cosmos DB accepts the index.
    sku: { type: String, required: true, trim: true, unique: true, maxlength: 64 },
    optionValues: { type: Schema.Types.Mixed, default: {} },
    prices: { type: Schema.Types.Mixed, default: {} },
    weightGrams: { type: Number, default: 0, min: 0 },
    stock: { tracked: { type: Boolean, default: false }, quantity: { type: Number, default: 0, min: 0 } },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: { transform: (_doc, ret) => { const { _id, __v, ...rest } = ret; void __v; return { id: _id.toString(), ...rest }; } },
  }
);
VariantSchema.index({ createdAt: 1 });

export const VariantModel = mongoose.model<IVariant>('Variant', VariantSchema);
