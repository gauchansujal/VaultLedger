import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'user' | 'household-admin' | 'system-admin';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  mfaEnabled: boolean;
  mfaSecret?: string; // encrypted at rest (see utils/encryption.ts) before saving
  failedLoginAttempts: number;
  lockUntil?: Date;
  passwordChangedAt?: Date;
  refreshTokenVersion: number; // bumped to invalidate all existing refresh tokens (e.g. on password change/logout-all)
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
      // Basic format check only - full validation happens at the Zod layer before this ever runs.
      // Defense in depth: schema-level validation is a second line of defense, not the primary one.
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default on queries - must opt in with .select('+passwordHash')
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
      select: false, // sensitive - never returned by default
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

// Prevent mass assignment: only these fields can ever be set via user-controlled input.
// Any controller that builds a User must pull fields explicitly - Mongoose alone doesn't
// protect against this, so this is enforced at the controller/validation layer, documented here
// as the canonical allow-list for the model.
export const USER_MUTABLE_FIELDS_BY_SELF = ['email'] as const;
export const USER_MUTABLE_FIELDS_BY_ADMIN = ['role'] as const;

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
