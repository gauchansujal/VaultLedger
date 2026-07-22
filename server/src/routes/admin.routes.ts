import { Router } from 'express';
import { listUsers, changeUserRole } from '../controllers/admin.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { changeRoleSchema } from '../utils/validation/admin.schema';

const router = Router();

// Every route here requires BOTH a valid session AND the system-admin role -
// least-privilege enforced centrally, not per-controller.
router.use(requireAuth, requireRole('system-admin'));

router.get('/users', listUsers);
router.patch('/users/:userId/role', validateBody(changeRoleSchema), changeUserRole);

export default router;
