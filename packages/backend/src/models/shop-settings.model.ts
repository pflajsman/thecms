import mongoose, { Schema, Document } from 'mongoose';

export interface ShopCurrency { code: string; decimals: number }
export interface VatRate { id: string; name: string; rate: number }

export interface BankAccount { currency: string; accountNumber?: string; iban?: string; bic?: string; holder: string }

export interface IShopSettings extends Document {
  currencies: ShopCurrency[];
  defaultCurrency?: string;
  vatRates: VatRate[];
  bankAccounts: BankAccount[];
  unpaidCancelDays: number;
  downloadDays: number;
  downloadLimit: number;
  shopEmail?: string;
  termsUrl?: string;
}

const ShopSettingsSchema = new Schema<IShopSettings>(
  {
    currencies: [{ _id: false, code: { type: String, required: true }, decimals: { type: Number, required: true } }],
    defaultCurrency: { type: String },
    vatRates: [{ _id: false, id: { type: String, required: true }, name: { type: String, required: true }, rate: { type: Number, required: true } }],
    bankAccounts: [{ _id: false, currency: String, accountNumber: String, iban: String, bic: String, holder: String }],
    unpaidCancelDays: { type: Number, default: 14 },
    downloadDays: { type: Number, default: 30 },
    downloadLimit: { type: Number, default: 5 },
    shopEmail: { type: String },
    termsUrl: { type: String },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const { _id, __v, createdAt, updatedAt, ...rest } = ret; void _id; void __v; void createdAt; void updatedAt; return rest; } },
  }
);

export const ShopSettingsModel = mongoose.model<IShopSettings>('ShopSettings', ShopSettingsSchema);
