import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditAction =
  | 'user.register'
  | 'user.login.success'
  | 'user.login.failed'
  | 'user.login.locked'
  | 'user.logout'
  | 'user.mfa.enabled'
  | 'user.token.refresh'
  | 'user.password.reset_requested'
  | 'user.password.reset_completed'
  | 'user.password.changed'
  | 'user.session.binding_mismatch'
  | 'payment.esewa.completed'
  | 'payment.esewa.failed'
  | 'transaction.create'
  | 'transaction.view'
  | 'transaction.update'
  | 'transaction.delete'
  | 'profile.update'
  | 'profile.avatar.update'
  | 'profile.data_export'
  | 'profile.data_import'
  | 'admin.role.change'
  | 'admin.user.update'
  | 'admin.user.delete'
  | 'admin.transaction.view'
  | 'admin.transaction.delete';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId; 
  action: AuditAction;
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, unknown>; 
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
   
  }
);


AuditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
