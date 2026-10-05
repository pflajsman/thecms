import mongoose, { Schema, type Document, type Types } from 'mongoose';

export enum ProjectRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

const RANK: Record<ProjectRole, number> = {
  [ProjectRole.VIEWER]: 0,
  [ProjectRole.EDITOR]: 1,
  [ProjectRole.ADMIN]: 2,
  [ProjectRole.OWNER]: 3,
};

/** True when role is at least minimum (Owner > Admin > Editor > Viewer). */
export const hasRole = (role: ProjectRole, minimum: ProjectRole) => RANK[role] >= RANK[minimum];

/** A user's role in one project. */
export interface IProjectMember extends Document {
  projectId: Types.ObjectId;
  userId: string;
  role: ProjectRole;
  createdAt: Date;
}

const ProjectMemberSchema = new Schema<IProjectMember>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: Object.values(ProjectRole), required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectMemberModel = mongoose.model<IProjectMember>('ProjectMember', ProjectMemberSchema);
