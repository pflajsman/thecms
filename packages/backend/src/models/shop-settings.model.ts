import mongoose, { Schema, Document } from 'mongoose';

export interface ShopCurrency { code: string; decimals: number }
export interface VatRate { id: string; name: string; rate: number }

export interface IShopSettings extends Document {
  currencies: ShopCurrency[];
  defaultCurrency?: string;
  vatRates: VatRate[];
}

const ShopSettingsSchema = new Schema<IShopSettings>(
  {
    currencies: [{ _id: false, code: { type: String, required: true }, decimals: { type: Number, required: true } }],
    defaultCurrency: { type: String },
    vatRates: [{ _id: false, id: { type: String, required: true }, name: { type: String, required: true }, rate: { type: Number, required: true } }],
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const { _id, __v, createdAt, updatedAt, ...rest } = ret; void _id; void __v; void createdAt; void updatedAt; return rest; } },
  }
);

export const ShopSettingsModel = mongoose.model<IShopSettings>('ShopSettings', ShopSettingsSchema);
