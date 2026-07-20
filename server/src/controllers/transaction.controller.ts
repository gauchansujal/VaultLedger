import { Request, Response } from 'express';
import { HydratedDocument } from 'mongoose';
import { Transaction, ITransaction } from '../models/Transaction.model';
import { encryptField, decryptField } from '../utils/encryption';
import { logAuditEvent } from '../utils/auditLogger';
import { CreateTransactionInput, UpdateTransactionInput } from '../utils/validation/transaction.schema';

// Shape returned to the client - decrypts the amount just before sending, never stores
// or logs the plaintext amount anywhere else.
function serializeTransaction(tx: HydratedDocument<ITransaction>) {
  return {
    id: tx.id as string,
    type: tx.type,
    category: tx.category,
    amount: Number(decryptField(tx.amountEncrypted)),
    currency: tx.currency,
    note: tx.note,
    occurredAt: tx.occurredAt,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

/**
 * POST /api/transactions
 */
export async function createTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const input = req.body as CreateTransactionInput;

  const transaction = await Transaction.create({
    userId,
    type: input.type,
    category: input.category,
    amountEncrypted: encryptField(String(input.amount)),
    currency: input.currency,
    note: input.note,
    occurredAt: input.occurredAt ?? new Date(),
  });

  // Re-fetch with the encrypted field selected (create() result already has it, but being
  // explicit here documents the select:false behavior for future maintainers)
  const withAmount = await Transaction.findById(transaction._id).select('+amountEncrypted');

  await logAuditEvent({
    req,
    action: 'transaction.create',
    userId,
    metadata: { transactionId: transaction.id, type: input.type, category: input.category },
    // Deliberately NOT logging the amount - financial values stay out of the audit trail's
    // metadata even though the trail itself is access-controlled, as defense in depth.
  });

  res.status(201).json(serializeTransaction(withAmount!));
}

/**
 * GET /api/transactions
 *
 * IDOR protection: query is ALWAYS scoped to req.user.sub. There is no way for a client
 * to request another user's transactions - no userId is ever accepted from the client.
 */
export async function listTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);

  const [docs, total] = await Promise.all([
    Transaction.find({ userId })
      .select('+amountEncrypted')
      .sort({ occurredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments({ userId }),
  ]);

  res.status(200).json({
    transactions: docs.map(serializeTransaction),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * GET /api/transactions/:id
 *
 * IDOR protection: the query filters by BOTH _id AND userId. If a user requests an ID
 * belonging to someone else, the query returns null (404), not another user's data -
 * this is the core defense against Insecure Direct Object Reference attacks.
 */
export async function getTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const { id } = req.params;

  const transaction = await Transaction.findOne({ _id: id, userId }).select('+amountEncrypted');

  if (!transaction) {
    // Same 404 whether the ID doesn't exist OR belongs to another user - do not leak
    // which case it is, that would itself be an information disclosure.
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }

  await logAuditEvent({ req, action: 'transaction.view', userId, metadata: { transactionId: id } });

  res.status(200).json(serializeTransaction(transaction));
}

/**
 * PATCH /api/transactions/:id
 */
export async function updateTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const { id } = req.params;
  const updates = req.body as UpdateTransactionInput;

  const transaction = await Transaction.findOne({ _id: id, userId }).select('+amountEncrypted');
  if (!transaction) {
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }

  if (updates.type) transaction.type = updates.type;
  if (updates.category) transaction.category = updates.category;
  if (updates.amount !== undefined) transaction.amountEncrypted = encryptField(String(updates.amount));
  if (updates.currency) transaction.currency = updates.currency;
  if (updates.note !== undefined) transaction.note = updates.note;
  if (updates.occurredAt) transaction.occurredAt = updates.occurredAt;

  await transaction.save();

  await logAuditEvent({
    req,
    action: 'transaction.update',
    userId,
    metadata: { transactionId: id, fields: Object.keys(updates) },
  });

  res.status(200).json(serializeTransaction(transaction));
}

/**
 * DELETE /api/transactions/:id
 */
export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const { id } = req.params;

  const transaction = await Transaction.findOneAndDelete({ _id: id, userId });
  if (!transaction) {
    res.status(404).json({ message: 'Transaction not found' });
    return;
  }

  await logAuditEvent({ req, action: 'transaction.delete', userId, metadata: { transactionId: id } });

  res.status(204).send();
}
