import rateLimit from 'express-rate-limit';
import { env } from '../config/env';


export const authRateLimiter = rateLimit({
  windowMs: env.loginRateLimitWindowMs,
  max: env.loginRateLimitMaxAttempts,
  standardHeaders: true, // return RateLimit-* headers
  legacyHeaders: false,
  message: {
    message: 'Too many attempts from this IP. Please try again later.',
  },
});


export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
