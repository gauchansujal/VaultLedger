import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';


export function ipBlocklistGuard(req: Request, res: Response, next: NextFunction): void {
  if (env.ipBlocklist.length === 0) {
    next();
    return;
  }

  const clientIp = req.ip ?? '';
  if (env.ipBlocklist.includes(clientIp)) {
    res.status(403).json({ message: 'Access denied' });
    return;
  }

  next();
}

/**
 * Allow-list guard for the most sensitive surface of the app (admin routes). Unlike the
 * blocklist above, an EMPTY allow-list means the feature is simply not configured/enabled
 * (fail open) - this is a deliberate default so the app doesn't silently lock out all
 * admin access just because ADMIN_IP_ALLOWLIST was never set in .env. Once at least one
 * IP is configured, only those IPs may reach anything behind this guard.
 *
 * This satisfies the brief's "IP-based blocking and allow-listing" requirement as an
 * additional layer on top of rate limiting - rate limiting slows down abuse from any IP,
 * allow-listing prevents abuse from any IP NOT explicitly trusted, for the routes where
 * that trade-off makes sense (e.g. an admin panel that's only ever used from known
 * office/campus IPs).
 */
export function adminIpAllowlistGuard(req: Request, res: Response, next: NextFunction): void {
  if (env.adminIpAllowlist.length === 0) {
    next();
    return;
  }

  const clientIp = req.ip ?? '';
  if (!env.adminIpAllowlist.includes(clientIp)) {
    res.status(403).json({ message: 'Access denied from this network' });
    return;
  }

  next();
}
