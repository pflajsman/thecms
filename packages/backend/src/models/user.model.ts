import mongoose, { Schema, Document } from 'mongoose';

export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER'
}

export interface IUser extends Document {
  entraId: string;
  email: string;
  displayName?: string;
  /** @deprecated Read only by the projects migration; access comes from project memberships. */
  role: UserRole;
  isSuperadmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    entraId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      // Not unique: the same person may sign in with Google and with an email code, as two Entra accounts.
      lowercase: true,
      trim: true,
      index: true
    },
    displayName: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.VIEWER,
      required: true
    },
    isSuperadmin: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const { __v, ...rest } = ret;
        return rest;
      }
    }
  }
);

export const User = mongoose.model<IUser>('User', userSchema);
