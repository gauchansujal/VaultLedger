import { Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog.model';


export async function getMyAuditLog(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25); // cap to prevent large-payload abuse

  const [entries, total] = await Promise.all([
    AuditLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments({ userId }),
  ]);

  res.status(200).json({
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}


export async function getAuditLogForUser(req: Request, res: Response): Promise<void> {
  const { userId } = req.params;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);

  const [entries, total] = await Promise.all([
    AuditLog.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments({ userId }),
  ]);

  res.status(200).json({
    entries,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
