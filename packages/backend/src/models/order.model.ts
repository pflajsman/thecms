import mongoose, { Schema, Document } from 'mongoose';
import type { PaymentMethod } from './shipping.model';

export type OrderStatus = 'PLACED' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';
export type FulfilmentStatus = 'UNFULFILLED' | 'SHIPPED';

export interface Address {
  name: string;
  company?: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  vatId?: string;
}

export interface OrderLine {
  productId: string;
  variantId: string;
  itemId: string;
  sku: string;
  name: string;
  optionLabels: { option: string; value: string }[];
  type: 'PHYSICAL' | 'DIGITAL';
  unitPrice: number;
  quantity: number;
  vatRate: number;
  lineTotal: number;
  weightGrams: number;
}

export interface OrderHistoryEntry {
  at: Date;
  type: string;
  by?: string;
  detail?: string;
}

export interface IOrder extends Document {
  number: string;
  accessToken: string;
  currency: string;
  language: string;
  customer: { email: string; name: string; phone?: string };
  customerId?: mongoose.Types.ObjectId;
  billingAddress: Address;
  shippingAddress?: Address;
  note?: string;
  lines: OrderLine[];
  shipping: { methodId: string; name: string; price: number } | null;
  payment: { method: PaymentMethod; fee: number; reference: string };
  totals: { items: number; shipping: number; paymentFee: number; total: number; vat: { rate: number; base: number; amount: number }[] };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfilmentStatus: FulfilmentStatus;
  tracking?: { number?: string; url?: string };
  internalNote?: string;
  history: OrderHistoryEntry[];
  idempotencyKey?: string;
  siteId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<Address>(
  { name: String, company: String, street: String, city: String, postalCode: String, country: String, vatId: String },
  { _id: false }
);

const LineSchema = new Schema<OrderLine>(
  {
    productId: String,
    variantId: String,
    itemId: String,
    sku: String,
    name: String,
    optionLabels: [{ _id: false, option: String, value: String }],
    type: { type: String, enum: ['PHYSICAL', 'DIGITAL'] },
    unitPrice: Number,
    quantity: Number,
    vatRate: Number,
    lineTotal: Number,
    weightGrams: Number,
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    // Unique: the collection is new, so Cosmos DB accepts the index.
    number: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    currency: { type: String, required: true },
    language: { type: String, required: true },
    customer: { email: { type: String, required: true, index: true }, name: { type: String, required: true }, phone: String },
    customerId: { type: Schema.Types.ObjectId },
    billingAddress: { type: AddressSchema, required: true },
    shippingAddress: { type: AddressSchema },
    note: String,
    lines: { type: [LineSchema], default: [] },
    shipping: { type: new Schema({ methodId: String, name: String, price: Number }, { _id: false }), default: null },
    payment: { type: new Schema({ method: String, fee: Number, reference: String }, { _id: false }), required: true },
    totals: {
      items: Number,
      shipping: Number,
      paymentFee: Number,
      total: Number,
      vat: [{ _id: false, rate: Number, base: Number, amount: Number }],
    },
    status: { type: String, enum: ['PLACED', 'COMPLETED', 'CANCELLED'], default: 'PLACED', index: true },
    paymentStatus: { type: String, enum: ['UNPAID', 'PAID', 'REFUNDED'], default: 'UNPAID', index: true },
    fulfilmentStatus: { type: String, enum: ['UNFULFILLED', 'SHIPPED'], default: 'UNFULFILLED', index: true },
    tracking: { type: new Schema({ number: String, url: String }, { _id: false }) },
    internalNote: String,
    // "type" must be spelled out, or Mongoose reads it as the array's element type.
    history: [{ _id: false, at: { type: Date, default: Date.now }, type: { type: String }, by: String, detail: String }],
    // Unique among orders that have one (sparse); retries return the first order.
    idempotencyKey: { type: String, unique: true, sparse: true },
    siteId: { type: Schema.Types.ObjectId },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret) => { const { _id, __v, ...rest } = ret; void __v; return { id: String(_id), ...rest }; } },
  }
);
// List sorts (Cosmos DB needs a single-field index per sort).
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ updatedAt: -1 });

export const OrderModel = mongoose.model<IOrder>('Order', OrderSchema);
