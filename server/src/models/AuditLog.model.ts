import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditAction =
  | 'user.register'
  | 'user.login.success'
  | 'user.login.failed'
  | 'user.login.locked'
  | 'user.logout'
  | 'user.mfa.enabled'
  | 'user.token.refresh'
  | 'transaction.create'
  | 'transaction.view'
  | 'transaction.update'
  | 'transaction.delete'
  | 'profile.update'
  | 'profile.avatar.update'
  | 'admin.role.change';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId; // who performed the action (undefined for anonymous/failed pre-auth events)
  action: AuditAction;
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, unknown>; // action-specific context - NEVER put passwords/tokens/secrets here
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Audit logs are append-only by design - no update timestamps, and we never
    // expose an update/delete route for this collection (see audit.routes.ts).
  }
);

// Compound index: fast lookup of "all events for user X, newest first" -
// the primary query pattern for the Transparency Vault UI.
AuditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
