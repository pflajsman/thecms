import mongoose, { Schema, type Document } from 'mongoose';

export type ProjectStatus = 'active' | 'archived';

/** A client workspace. All tenant data carries its id (see plugins/tenant-scoped). */
export interface IProject extends Document {
  name: string;
  status: ProjectStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const ProjectModel = mongoose.model<IProject>('Project', ProjectSchema);
