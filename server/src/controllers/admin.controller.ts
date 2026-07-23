import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { Transaction } from '../models/Transaction.model';
import { decryptField } from '../utils/encryption';
import { logAuditEvent } from '../utils/auditLogger';
import { ChangeRoleInput, AdminUpdateUserInput } from '../utils/validation/admin.schema';

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
 * GET /api/admin/users/:userId
 */
export async function getUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.status(200).json({
    id: user.id,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    mfaEnabled: user.mfaEnabled,
    isLocked: !!(user.lockUntil && user.lockUntil.getTime() > Date.now()),
    createdAt: user.createdAt,
  });
}

/**
 * PATCH /api/admin/users/:userId
 *
 * Deliberately narrow: only email is editable here. Role changes go through the
 * dedicated changeUserRole endpoint below, which has its own stricter safeguards
 * (e.g. cannot change your own role) - keeping them separate means that extra check
 * can't accidentally be bypassed by routing a role change through this more general
 * "edit user" endpoint instead.
 */
export async function updateUser(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.sub;
  const { userId } = req.params;
  const updates = req.body as AdminUpdateUserInput;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (updates.email && updates.email !== user.email) {
    const existing = await User.findOne({ email: updates.email });
    if (existing) {
      res.status(400).json({ message: 'Email is already in use' });
      return;
    }
    user.email = updates.email;
  }

  await user.save();

  await logAuditEvent({
    req,
    action: 'admin.user.update',
    userId: adminId,
    metadata: { targetUserId: userId, fields: Object.keys(updates) },
  });

  res.status(200).json({ id: user.id, email: user.email, role: user.role });
}

/**
 * DELETE /api/admin/users/:userId
 *
 * Cascades to delete the user's transactions (their financial data has no purpose
 * without the account that owns it). Audit log entries are deliberately NOT deleted -
 * the audit trail's integrity as a historical record matters more than tidiness, and
 * this action itself gets logged, attributed to the admin who performed it, before
 * the target user record is removed.
 */
export async function deleteUser(req: Request, res: Response): Promise<void> {
  const adminId = req.user?.sub;
  const { userId } = req.params;

  if (userId === adminId) {
    res.status(400).json({ message: 'You cannot delete your own account' });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  await logAuditEvent({
    req,
    action: 'admin.user.delete',
    userId: adminId,
    metadata: { targetUserId: userId, targetEmail: user.email },
  });

  await Transaction.deleteMany({ userId });
  await user.deleteOne();

  res.status(204).send();
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

/**
 * GET /api/admin/transactions
 *
 * Cross-user visibility, deliberately isolated to this admin-only route rather than
 * extending the regular /api/transactions endpoints - keeps the "can see everyone's
 * data" capability in one clearly-marked place rather than threading an "isAdmin"
 * branch through the normal user-facing transaction controller.
 */
export async function listAllTransactions(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);
  const filterUserId = req.query.userId as string | undefined;

  const query = filterUserId ? { userId: filterUserId } : {};

  const [docs, total] = await Promise.all([
    Transaction.find(query)
      .select('+amountEncrypted')
      .populate('userId', 'email')
      .sort({ occurredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments(query),
  ]);

  await logAuditEvent({ req, action: 'admin.transaction.view', metadata: { filterUserId } });

  res.status(200).json({
    transactions: docs.map((tx) => ({
      id: tx.id,
      ownerEmail: (tx.userId as unknown as { email: string }).email,
      type: tx.type,
      category: tx.category,
      amount: Number(decryptField(tx.amountEncrypted)),
      currency: tx.currency,
      note: tx.note,
      occurredAt: tx.occurredAt,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * DELETE /api/admin/transactions/:id
 *
 * For moderation/support purposes (e.g. removing a transaction at a user's request
 * without needing direct database access). Unlike the regular user-facing delete,
 * this is NOT scoped to req.user.sub - it's deliberately allowed to delete ANY
 * transaction, which is exactly why it's gated behind requireRole('system-admin').
 */
export async function deleteAnyTransaction(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const transaction = await Transaction.findByIdAndDelete(id);
  if (!transaction) {
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }

  await logAuditEvent({
    req,
    action: 'admin.transaction.delete',
    metadata: { transactionId: id, ownerUserId: transaction.userId },
  });

  res.status(204).send();
}
