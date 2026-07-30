import { z } from 'zod';

// Explicit allow-list: only 'email' can be changed by the user themselves.
// This is what prevents mass assignment - even if a client sends { role: "system-admin" }
// or { failedLoginAttempts: 0 } in the same request body, those keys are stripped by
// Zod before the controller ever sees them, because they're not declared here.
export const updateProfileSchema = z.object({
  email: z.string().email('Invalid email address').max(254).optional(),
});

// Same field-level rules as creating a transaction normally (see transaction.schema.ts) -
// bulk import doesn't get a looser validation path just because it's bulk.
const importTransactionRowSchema = z.object({
  type: z.enum(['income', 'expense']),
  category: z.enum([
    'housing',
    'food',
    'transport',
    'utilities',
    'entertainment',
    'health',
    'savings',
    'subscriptions',
    'other',
  ]),
  amount: z.number().positive().max(10_000_000),
  currency: z.string().length(3).optional(),
  note: z.string().max(280).optional(),
  occurredAt: z.coerce.date().optional(),
});

export const importTransactionsSchema = z.object({
  transactions: z.array(importTransactionRowSchema).min(1, 'Provide at least one transaction to import'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ImportTransactionsInput = z.infer<typeof importTransactionsSchema>;
