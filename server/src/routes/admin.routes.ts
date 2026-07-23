import { Router } from 'express';
import {
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  changeUserRole,
  listAllTransactions,
  deleteAnyTransaction,
} from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { changeRoleSchema, adminUpdateUserSchema } from '../utils/validation/admin.schema';

const router = Router();

// Every route here requires BOTH a valid session AND the system-admin role -
// least-privilege enforced centrally, not per-controller.
router.use(requireAuth, requireRole('system-admin'));

router.get('/users', listUsers);
router.get('/users/:userId', getUser);
router.patch('/users/:userId', validateBody(adminUpdateUserSchema), updateUser);
router.delete('/users/:userId', deleteUser);
router.patch('/users/:userId/role', validateBody(changeRoleSchema), changeUserRole);

router.get('/transactions', listAllTransactions);
router.delete('/transactions/:id', deleteAnyTransaction);

export default router;
