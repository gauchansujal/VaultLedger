import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Validates req.body against the given schema and REPLACES req.body with the parsed,
 * stripped result. This is what actually blocks mass-assignment attacks: any extra
 * fields the client sends (e.g. { email, password, role: "system-admin" }) are silently
 * dropped because Zod's default `.parse()` only keeps keys defined in the schema.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
