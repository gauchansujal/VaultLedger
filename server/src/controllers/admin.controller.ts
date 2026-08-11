import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { Transaction } from '../models/Transaction.model';
import { decryptField } from '../utils/encryption';
import { logAuditEvent } from '../utils/auditLogger';
import { ChangeRoleInput, AdminUpdateUserInput } from '../utils/validation/admin.schema';


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
