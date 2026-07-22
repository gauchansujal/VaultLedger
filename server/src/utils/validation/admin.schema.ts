import { z } from 'zod';

export const changeRoleSchema = z.object({
  role: z.enum(['user', 'household-admin', 'system-admin']),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
