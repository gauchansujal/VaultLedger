import { Request, Response } from 'express';
import crypto from 'crypto';
import { Transaction } from '../models/Transaction.model';
import { encryptField, decryptField } from '../utils/encryption';
import { buildEsewaFormParams, verifyEsewaPayment } from '../utils/esewa';
import { logAuditEvent } from '../utils/auditLogger';
import { CreateTransactionInput } from '../utils/validation/transaction.schema';

/**
 * POST /api/payments/esewa/initiate
 *
 * Creates the transaction in a 'pending' state FIRST, before the user ever reaches
 * eSewa. This means even if the user closes the tab mid-payment or eSewa's redirect
 * fails, there's still an honest record that a payment was attempted - nothing about
 * this flow depends on the browser successfully returning to us.
 */
export async function initiateEsewaPayment(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const input = req.body as CreateTransactionInput;

  // Our own unique reference for this attempt - sent to eSewa and used later to look
  // the transaction back up when eSewa calls back, and to independently verify status.
  const transactionUuid = crypto.randomUUID();

  const transaction = await Transaction.create({
    userId,
    type: input.type,
    category: input.category,
    amountEncrypted: encryptField(String(input.amount)),
    currency: input.currency,
    note: input.note,
    occurredAt: input.occurredAt ?? new Date(),
    paymentMethod: 'esewa',
    paymentStatus: 'pending',
    esewaTransactionUuid: transactionUuid,
  });

  const formParams = buildEsewaFormParams(input.amount, transactionUuid);

  await logAuditEvent({
    req,
    action: 'transaction.create',
    userId,
    metadata: { transactionId: transaction.id, paymentMethod: 'esewa' },
  });

  res.status(201).json({
    transactionId: transaction.id,
    formUrl: process.env.ESEWA_FORM_URL ?? 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
    formParams,
  });
}

/**
 * POST /api/payments/esewa/verify
 *
 * Called by the frontend after the browser is redirected back from eSewa (success or
 * failure page). This does NOT trust that redirect on its own - see verifyEsewaPayment's
 * comment for why. Only a genuine 'COMPLETE' status from eSewa's own API marks the
 * transaction as paid.
 */
export async function verifyEsewaTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const { transactionUuid } = req.body as { transactionUuid: string };

  const transaction = await Transaction.findOne({
    esewaTransactionUuid: transactionUuid,
    userId, // IDOR protection - can't verify/complete someone else's payment attempt
  }).select('+amountEncrypted');

  if (!transaction) {
    res.status(404).json({ message: 'Payment record not found' });
    return;
  }

  if (transaction.paymentStatus === 'completed') {
    // Already verified previously (e.g. user refreshed the success page) - idempotent,
    // don't re-verify or double-log.
    res.status(200).json({ paymentStatus: 'completed' });
    return;
  }

  const amount = Number(decryptField(transaction.amountEncrypted));

  let statusResult;
  try {
    statusResult = await verifyEsewaPayment(transactionUuid, amount);
  } catch (err) {
    console.error('[esewa] Status verification request failed:', err);
    res.status(502).json({ message: 'Could not verify payment status with eSewa right now' });
    return;
  }

  if (statusResult.status === 'COMPLETE') {
    transaction.paymentStatus = 'completed';
    transaction.esewaRefId = statusResult.ref_id;
    await transaction.save();

    await logAuditEvent({
      req,
      action: 'payment.esewa.completed',
      userId,
      metadata: { transactionId: transaction.id, esewaRefId: statusResult.ref_id },
    });
  } else {
    transaction.paymentStatus = 'failed';
    await transaction.save();

    await logAuditEvent({
      req,
      action: 'payment.esewa.failed',
      userId,
      metadata: { transactionId: transaction.id, esewaStatus: statusResult.status },
    });
  }

  res.status(200).json({ paymentStatus: transaction.paymentStatus });
}
