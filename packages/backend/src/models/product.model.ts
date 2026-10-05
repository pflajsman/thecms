import mongoose, { Schema, Document } from 'mongoose';
import { tenantScoped, type TenantFields } from './plugins/tenant-scoped';

export enum ProductType { PHYSICAL = 'PHYSICAL', DIGITAL = 'DIGITAL' }
export type Labels = Record<string, string>;
export interface ProductOptionValue { key: string; labels: Labels }
export interface ProductOption { key: string; labels: Labels; values: ProductOptionValue[] }
export interface DigitalFile { blobName: string; originalName: string; mimeType: string; size: number }

export interface IProduct extends Document, TenantFields {
  itemId: mongoose.Types.ObjectId;
  type: ProductType;
  vatRateId: string;
  active: boolean;
  options: ProductOption[];
  digitalFile?: DigitalFile;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OptionValueSchema = new Schema<ProductOptionValue>({ key: { type: String, required: true }, labels: { type: Schema.Types.Mixed, default: {} } }, { _id: false });
const OptionSchema = new Schema<ProductOption>({ key: { type: String, required: true }, labels: { type: Schema.Types.Mixed, default: {} }, values: [OptionValueSchema] }, { _id: false });

const ProductSchema = new Schema<IProduct>(
  {
    // Unique: one product per content item. The collection is new, so Cosmos DB accepts the index.
    itemId: { type: Schema.Types.ObjectId, required: true, unique: true },
    type: { type: String, enum: Object.values(ProductType), required: true },
    vatRateId: { type: String, required: true, index: true },
    active: { type: Boolean, default: false, index: true },
    options: { type: [OptionSchema], default: [] },
    digitalFile: { type: new Schema<DigitalFile>({ blobName: String, originalName: String, mimeType: String, size: Number }, { _id: false }) },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const { _id, __v, ...rest } = ret; void __v; return { id: _id.toString(), ...rest }; } },
  }
);
// Lists sort on one field each (Cosmos DB rule).
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ updatedAt: -1 });

ProductSchema.plugin(tenantScoped);

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
