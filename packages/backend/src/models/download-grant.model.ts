import mongoose, { Schema, Document } from 'mongoose';

/** A personal download link for one paid digital order line. */
export interface IDownloadGrant extends Document {
  token: string;
  orderId: mongoose.Types.ObjectId;
  lineIndex: number;
  productId: string;
  expiresAt: Date;
  limit: number;
  used: number;
  createdAt: Date;
}

const DownloadGrantSchema = new Schema<IDownloadGrant>(
  {
    // Unique: the collection is new, so Cosmos DB accepts the index.
    token: { type: String, required: true, unique: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    lineIndex: { type: Number, required: true },
    productId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    limit: { type: Number, required: true },
    used: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const DownloadGrantModel = mongoose.model<IDownloadGrant>('DownloadGrant', DownloadGrantSchema);
