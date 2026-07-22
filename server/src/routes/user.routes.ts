import { Router } from 'express';
import { getMe, updateMe, uploadAvatar } from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { updateProfileSchema } from '../utils/validation/user.schema';
import { avatarUpload } from '../middleware/upload.middleware';

const router = Router();

router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, validateBody(updateProfileSchema), updateMe);
router.patch('/me/avatar', requireAuth, avatarUpload.single('avatar'), uploadAvatar);

export default router;
