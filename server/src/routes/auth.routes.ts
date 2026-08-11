import { Router } from 'express';
import {
  register,
  login,
  logout,
  refresh,
  setupMfa,
  verifyAndEnableMfa,
  forgotPassword,
  resetPassword,
  changePassword,
} from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate.middleware';
import {
  registerSchema,
  loginSchema,
  mfaVerifySchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../utils/validation/auth.schema';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), register); 
router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);


router.post('/mfa/setup', requireAuth, setupMfa);
router.post('/mfa/verify',  requireAuth, authRateLimiter,validateBody(mfaVerifySchema), verifyAndEnableMfa);//authRateLimiter,


router.post('/forgot-password', authRateLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authRateLimiter, validateBody(resetPasswordSchema), resetPassword);
router.patch('/change-password', requireAuth, validateBody(changePasswordSchema), changePassword);

export default router;
