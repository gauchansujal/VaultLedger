import { z } from 'zod';

// Strong password policy: length, complexity, all required by the brief's "Robust password
// policy" criterion. We check complexity here (fast, clear error messages) rather than
// relying only on a regex, so we can give specific feedback per missing rule.
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((val) => /[a-z]/.test(val), 'Password must contain a lowercase letter')
  .refine((val) => /[A-Z]/.test(val), 'Password must contain an uppercase letter')
  .refine((val) => /[0-9]/.test(val), 'Password must contain a number')
  .refine((val) => /[^A-Za-z0-9]/.test(val), 'Password must contain a special character');

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required'),
  mfaToken: z.string().length(6).optional(), // TOTP code, only required if MFA is enabled on the account
});

export const mfaVerifySchema = z.object({
  mfaToken: z.string().length(6, 'MFA code must be 6 digits'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
