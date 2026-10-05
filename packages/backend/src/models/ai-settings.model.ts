import mongoose, { Schema } from 'mongoose';
import { tenantScoped, type TenantFields } from './plugins/tenant-scoped';

/** One document per project: whether AI features are allowed in it. */
export interface IAiSettings extends TenantFields {
  enabled: boolean;
}

const AiSettingsSchema = new Schema<IAiSettings>({ enabled: { type: Boolean, default: true } });

AiSettingsSchema.plugin(tenantScoped);

export const AiSettingsModel = mongoose.model<IAiSettings>('AiSettings', AiSettingsSchema, 'aisettings');
