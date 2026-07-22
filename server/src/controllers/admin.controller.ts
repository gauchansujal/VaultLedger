import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { logAuditEvent } from '../utils/auditLogger';
import { ChangeRoleInput } from '../utils/validation/admin.schema';

/**
 * GET /api/admin/users
 *
 * Access control: gated by requireRole('system-admin') in the router, not here - this
 * keeps the "who is allowed" decision in one central place (auth.middleware.ts) rather
 * than duplicated per-controller.
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);

  const [users, total] = await Promise.all([
    User.find()
      .select('email role avatarUrl mfaEnabled failedLoginAttempts lockUntil createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(),
  ]);

  res.status(200).json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatarUrl,
      mfaEnabled: u.mfaEnabled,
      isLocked: !!(u.lockUntil && u.lockUntil.getTime() > Date.now()),
      createdAt: u.createdAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * PATCH /api/admin/users/:userId/role
 *
 * Deliberately blocks an admin from changing their OWN role through this endpoint -
 * prevents an admin accidentally (or via a hijacked session) locking themselves out of
 * admin access, and prevents a compromised admin session being used to "downgrade" the
 * audit trail's attribution of who made a change.
 */
export async function changeUserRole(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.sub;
  const { userId } = req.params;
  const { role } = req.body as ChangeRoleInput;

  if (userId === adminId) {
    res.status(400).json({ message: 'You cannot change your own role' });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const previousRole = user.role;
  user.role = role;
  await user.save();

  await logAuditEvent({
    req,
    action: 'admin.role.change',
    userId: adminId,
    metadata: { targetUserId: userId, from: previousRole, to: role },
  });

  res.status(200).json({ id: user.id, email: user.email, role: user.role });
}
