import { Request, Response } from 'express';
import crypto from 'crypto';
import { Transaction } from '../models/Transaction.model';
import { encryptField, decryptField } from '../utils/encryption';
import { buildEsewaFormParams, verifyEsewaPayment } from '../utils/esewa';
import { logAuditEvent } from '../utils/auditLogger';
import { CreateTransactionInput } from '../utils/validation/transaction.schema';


export async function initiateEsewaPayment(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const input = req.body as CreateTransactionInput;

 
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
