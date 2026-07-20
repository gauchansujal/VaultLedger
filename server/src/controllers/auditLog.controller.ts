import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog.model';

/**
 * Returns the audit trail for the currently authenticated user only.
 * This is the "Transparency Vault" - the user-facing feature that lets a user see
 * every recorded action tied to their account (their own logins, MFA changes, etc.).
 *
 * IDOR protection: userId is taken from req.user (the verified JWT), never from a
 * client-supplied parameter - a user cannot pass someone else's ID to view their log.
 */
export async function getMyAuditLog(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25); // cap to prevent large-payload abuse

  const [entries, total] = await Promise.all([
    AuditLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments({ userId }),
  ]);

  res.status(200).json({
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * Admin-only: view audit log for ANY user, or system-wide. Gated by requireRole('system-admin')
 * at the route level - this controller assumes that check already passed.
 */
export async function getAuditLogForUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);

  const [entries, total] = await Promise.all([
    AuditLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments({ userId }),
  ]);

  res.status(200).json({
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
