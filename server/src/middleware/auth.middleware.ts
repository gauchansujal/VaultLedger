import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Requires a valid access token (from httpOnly cookie). Attaches decoded payload to req.user.
 * This is the base authentication gate - use requireRole() on top of this for authorization.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.accessToken;

  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session' });
  }
}

/**
 * Role-based access control gate. Must run after requireAuth.
 * Enforces least-privilege: routes explicitly opt in to which roles may access them,
 * rather than defaulting open.
 */
export function requireRole(...allowedRoles: Array<'user' | 'household-admin' | 'system-admin'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
