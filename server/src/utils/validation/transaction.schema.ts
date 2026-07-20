import { z } from 'zod';
import { TRANSACTION_CATEGORIES } from '../../models/Transaction.model';

export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.enum(TRANSACTION_CATEGORIES),
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(10_000_000, 'Amount exceeds maximum allowed value'),
  currency: z.string().length(3).optional().default('GBP'),
  note: z.string().max(280).optional(),
  occurredAt: z.coerce.date().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
