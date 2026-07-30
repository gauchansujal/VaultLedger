import { Router } from 'express';
import { initiateEsewaPayment, verifyEsewaTransaction } from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createTransactionSchema } from '../utils/validation/transaction.schema';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);

router.post('/esewa/initiate', validateBody(createTransactionSchema), initiateEsewaPayment);
router.post(
  '/esewa/verify',
  validateBody(z.object({ transactionUuid: z.string().uuid() })),
  verifyEsewaTransaction
);

export default router;
