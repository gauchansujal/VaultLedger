import { Router } from 'express';
import { getMe, updateMe, uploadAvatar, exportMyData, importTransactions } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { updateProfileSchema, importTransactionsSchema } from '../utils/validation/user.schema';
import { avatarUpload } from '../middleware/upload.middleware';
import { generalApiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, validateBody(updateProfileSchema), updateMe);
router.patch('/me/avatar', requireAuth, avatarUpload.single('avatar'), uploadAvatar);

router.get('/me/export', requireAuth, exportMyData);
router.post(
  '/me/import',
  requireAuth,
  generalApiLimiter, // bulk-insert endpoint - worth its own limiter, distinct from auth endpoints
  validateBody(importTransactionsSchema),
  importTransactions
);

export default router;
