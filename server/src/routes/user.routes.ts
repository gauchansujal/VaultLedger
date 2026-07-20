import { Router } from 'express';
import { getMe, updateMe } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { updateProfileSchema } from '../utils/validation/user.schema';

const router = Router();

router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, validateBody(updateProfileSchema), updateMe);

export default router;
