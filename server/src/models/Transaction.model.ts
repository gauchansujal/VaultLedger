import mongoose, { Schema, Document, Model } from 'mongoose';

export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'manual' | 'esewa';
export type PaymentStatus = 'not_applicable' | 'pending' | 'completed' | 'failed';

export const TRANSACTION_CATEGORIES = [
  'housing',
  'food',
  'transport',
  'utilities',
  'entertainment',
  'health',
  'savings',
  'subscriptions',
  'other',
] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId; 
  type: TransactionType;
  category: TransactionCategory;
  amountEncrypted: string; 
  currency: string;
  note?: string;
  occurredAt: Date;
  
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  esewaTransactionUuid?: string; 
  esewaRefId?: string; 
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    category: {
      type: String,
      enum: TRANSACTION_CATEGORIES,
      required: true,
    },
    // Amount is financial data - encrypted at rest per the brief's "Encryption of sensitive
    // data where required" requirement. Stored as a string (iv:authTag:ciphertext), decrypted
    // only in the controller layer right before sending to the authenticated owner.
    amountEncrypted: {
      type: String,
      required: true,
      select: false, // never returned raw - must be explicitly selected and then decrypted
    },
    currency: {
      type: String,
      default: 'GBP',
      maxlength: 3,
    },
    note: {
      type: String,
      maxlength: 280,
      trim: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ['manual', 'esewa'],
      default: 'manual',
    },
    paymentStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'completed', 'failed'],
      default: 'not_applicable',
    },
    esewaTransactionUuid: {
      type: String,
      index: true,
      sparse: true, // most transactions never have this - avoid indexing a mostly-null field densely
    },
    esewaRefId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: fast lookup of "all transactions for user X, most recent first" -
// the primary query pattern, and also enforces that queries scoped by userId are efficient
// (important once this collection grows - avoids full collection scans that could be abused
// for a denial-of-service via expensive unfiltered queries).
TransactionSchema.index({ userId: 1, occurredAt: -1 });

export const Transaction: Model<ITransaction> = mongoose.model<ITransaction>(
  'Transaction',
  TransactionSchema
);
