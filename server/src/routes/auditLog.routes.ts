import { Router } from 'express';
import { getMyAuditLog, getAuditLogForUser } from '../controllers/auditLog.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Every authenticated user can see their own Transparency Vault
router.get('/me', requireAuth, getMyAuditLog);

// system-admin only: view any user's audit trail (e.g. for incident response)
router.get('/user/:userId', requireAuth, requireRole('system-admin'), getAuditLogForUser);

export default router;
