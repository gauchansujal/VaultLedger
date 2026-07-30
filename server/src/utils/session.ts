import crypto from 'crypto';
import { Request } from 'express';

/**
 * Optional session binding (see brief: "session binding to user agents or devices").
 *
 * Hashes the User-Agent header at login time and embeds that hash in the refresh token.
 * On every refresh, the CURRENT request's User-Agent is re-hashed and compared. A
 * mismatch means the refresh token is being used from a different browser/device than
 * the one that originally logged in - a strong signal the token was stolen (e.g.
 * exfiltrated via a network intercept, malware, or a misconfigured proxy log) and is
 * now being replayed elsewhere.
 *
 * Deliberately NOT applied to the access token: access tokens are short-lived (15 min)
 * and already re-validated frequently via refresh; binding only the longer-lived refresh
 * token gives the real security benefit without adding friction to every single request.
 *
 * Known limitation, documented rather than hidden: this is a heuristic, not a hard
 * guarantee - User-Agent strings are client-supplied and technically spoofable, and
 * legitimate browser auto-updates can occasionally change the string. This is why it's
 * marked "optional" in the brief and implemented as an additional defense-in-depth
 * layer, not a replacement for the core token-expiry and rotation mechanisms.
 */
export function hashUserAgent(req: Request): string {
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  return crypto.createHash('sha256').update(userAgent).digest('hex');
}
