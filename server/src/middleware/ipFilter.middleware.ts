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
