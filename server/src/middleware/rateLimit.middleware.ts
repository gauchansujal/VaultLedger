import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Applied to /login, /register, /mfa/verify - the endpoints most valuable to attack
 * with credential stuffing or brute force. Limits by IP address.
 *
 * Note: this is IP-based rate limiting (system-wide brute-force protection). It's paired
 * with per-account lockout logic in the auth controller (failedLoginAttempts/lockUntil on
 * the User model) so that an attacker distributing requests across many IPs against a
 * single account is still stopped.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.loginRateLimitWindowMs,
  max: env.loginRateLimitMaxAttempts,
  standardHeaders: true, // return RateLimit-* headers
  legacyHeaders: false,
  message: {
    message: 'Too many attempts from this IP. Please try again later.',
  },
});

// Looser limiter for less sensitive but still abuse-prone endpoints (e.g. resending MFA codes)
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
