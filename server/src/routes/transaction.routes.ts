import { Router } from 'express';
import {
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
} from '../controllers/transaction.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { createTransactionSchema, updateTransactionSchema } from '../utils/validation/transaction.schema';

const router = Router();

// Every route requires authentication - transactions are always scoped to req.user.sub
// inside the controllers, never trusted from the URL or body.
router.use(requireAuth);

router.post('/', validateBody(createTransactionSchema), createTransaction);
router.get('/', listTransactions);
router.get('/:id', getTransaction);
router.patch('/:id', validateBody(updateTransactionSchema), updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
