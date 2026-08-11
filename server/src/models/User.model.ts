import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'user' | 'household-admin' | 'system-admin';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  failedLoginAttempts: number;
  lockUntil?: Date;
  passwordChangedAt?: Date;
  passwordHistory: string[]; 
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  refreshTokenVersion: number; 
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, 
    },
    role: {
      type: String,
      enum: ['user', 'household-admin', 'system-admin'],
      default: 'user',
    },
    avatarUrl: {
      type: String,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false, 
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
    
    passwordHistory: {
      type: [String],
      default: [],
      select: false,
    },
   
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    refreshTokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual: is the account currently locked?
UserSchema.virtual('isLocked').get(function (this: IUser) {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
});


export const USER_MUTABLE_FIELDS_BY_SELF = ['email'] as const;
export const USER_MUTABLE_FIELDS_BY_ADMIN = ['role'] as const;

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
