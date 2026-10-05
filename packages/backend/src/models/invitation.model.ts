import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { ProjectRole } from './project-member.model';

/** An invitation to a project, accepted through a one-time link. Only the link token's hash is stored. */
export interface IInvitation extends Document {
  projectId: Types.ObjectId;
  email: string;
  role: ProjectRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: string;
  createdAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    role: { type: String, enum: Object.values(ProjectRole), required: true },
    tokenHash: { type: String, required: true, unique: true },
    invitedBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const InvitationModel = mongoose.model<IInvitation>('Invitation', InvitationSchema);
