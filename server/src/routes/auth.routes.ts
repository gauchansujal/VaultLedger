import { Router } from 'express';
import { register, login, logout, refresh, setupMfa, verifyAndEnableMfa } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate.middleware';
import { registerSchema, loginSchema, mfaVerifySchema } from '../utils/validation/auth.schema';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', authRateLimiter, validateBody(registerSchema), register);
router.post('/login', authRateLimiter, validateBody(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);

// MFA setup requires the user to already be logged in (first-factor complete)
router.post('/mfa/setup', requireAuth, setupMfa);
router.post('/mfa/verify', requireAuth, validateBody(mfaVerifySchema), verifyAndEnableMfa);

export default router;
