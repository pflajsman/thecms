import mongoose, { Schema } from 'mongoose';

/** One document: whether AI features are allowed on this installation. */
export interface IAiSettings {
  enabled: boolean;
}

const AiSettingsSchema = new Schema<IAiSettings>({ enabled: { type: Boolean, default: true } });

export const AiSettingsModel = mongoose.model<IAiSettings>('AiSettings', AiSettingsSchema, 'aisettings');
