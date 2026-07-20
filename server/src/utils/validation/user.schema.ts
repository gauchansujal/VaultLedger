import { z } from 'zod';

// Explicit allow-list: only 'email' can be changed by the user themselves.
// This is what prevents mass assignment - even if a client sends { role: "system-admin" }
// or { failedLoginAttempts: 0 } in the same request body, those keys are stripped by
// Zod before the controller ever sees them, because they're not declared here.
export const updateProfileSchema = z.object({
  email: z.string().email('Invalid email address').max(254).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
