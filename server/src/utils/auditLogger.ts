import { Request } from 'express';
import { AuditLog, AuditAction } from '../models/AuditLog.model';

// Defense in depth: even though callers should never pass sensitive fields, strip any
// known-sensitive key names from metadata before writing, so a future mistake elsewhere
// in the codebase can't accidentally leak a secret into the audit trail.
const SENSITIVE_KEYS = ['password', 'passwordHash', 'mfaSecret', 'token', 'accessToken', 'refreshToken'];

function redact(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

interface LogEventParams {
  req: Request;
  action: AuditAction;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit event. Deliberately fire-and-forget from the caller's perspective in
 * spirit (awaited here, but failures are caught and logged rather than thrown) - an audit
 * logging failure should never block or crash the actual user-facing request.
 */
export async function logAuditEvent({ req, action, userId, metadata }: LogEventParams): Promise<void> {
  try {
    await AuditLog.create({
      userId,
      action,
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.get('user-agent'),
      metadata: redact(metadata),
    });
  } catch (err) {
    // Log to console rather than throw - a broken audit write should not break the request
    // it's describing. In production this would also alert via the monitoring pipeline.
    console.error('[audit] Failed to write audit log:', err);
  }
}
