import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_ON_DELIVERY';
export const PAYMENT_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CASH_ON_DELIVERY'];

export interface IShippingZone extends Document { name: string; countries: string[]; rest: boolean; order: number }
export interface ShippingBand { upToGrams: number | null; prices: Record<string, number> }
export interface ShippingRate { zoneId: mongoose.Types.ObjectId; bands: ShippingBand[] }
export interface IShippingMethod extends Document {
  labels: Record<string, string>;
  active: boolean;
  paymentMethods: PaymentMethod[];
  codFees: Record<string, number>;
  freeOver: Record<string, number>;
  rates: ShippingRate[];
  order: number;
}

const json = { transform: (_d: unknown, ret: Record<string, unknown>) => { const { _id, __v, ...rest } = ret; void __v; return { id: String(_id), ...rest }; } };

const ZoneSchema = new Schema<IShippingZone>(
  { name: { type: String, required: true, trim: true }, countries: { type: [String], default: [] }, rest: { type: Boolean, default: false }, order: { type: Number, default: 0, index: true } },
  { timestamps: true, toJSON: json }
);

const MethodSchema = new Schema<IShippingMethod>(
  {
    labels: { type: Schema.Types.Mixed, default: {} },
    active: { type: Boolean, default: true },
    paymentMethods: { type: [String], enum: PAYMENT_METHODS, default: ['BANK_TRANSFER'] },
    codFees: { type: Schema.Types.Mixed, default: {} },
    freeOver: { type: Schema.Types.Mixed, default: {} },
    rates: [{ _id: false, zoneId: { type: Schema.Types.ObjectId, ref: 'ShippingZone', index: true }, bands: [{ _id: false, upToGrams: { type: Number, default: null }, prices: { type: Schema.Types.Mixed, default: {} } }] }],
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true, minimize: false, toJSON: json }
);

export const ShippingZoneModel = mongoose.model<IShippingZone>('ShippingZone', ZoneSchema);
export const ShippingMethodModel = mongoose.model<IShippingMethod>('ShippingMethod', MethodSchema);
