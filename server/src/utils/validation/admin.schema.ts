import { z } from 'zod';

export const changeRoleSchema = z.object({
  role: z.enum(['user', 'household-admin', 'system-admin']),
});

export const adminUpdateUserSchema = z.object({
  email: z.string().email('Invalid email address').max(254).optional(),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
