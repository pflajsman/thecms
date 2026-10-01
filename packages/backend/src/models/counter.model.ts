import mongoose, { Schema } from 'mongoose';

/** Named counters such as "order-2026"; incremented atomically. */
export interface ICounter {
  _id: string;
  value: number;
}

const CounterSchema = new Schema<ICounter>({ _id: { type: String, required: true }, value: { type: Number, default: 0 } }, { versionKey: false });

export const CounterModel = mongoose.model<ICounter>('Counter', CounterSchema);
