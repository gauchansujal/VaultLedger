import { Request, Response } from 'express';
import { User } from '../models/User.model';
import { logAuditEvent } from '../utils/auditLogger';
import { UpdateProfileInput } from '../utils/validation/user.schema';

/**
 * GET /api/users/me
 *
 * IDOR protection: the user ID comes exclusively from the verified JWT (req.user.sub),
 * never from a URL param or query string. There is deliberately no "GET /users/:id"
 * route for regular users - only "/me" - so there is no ID for an attacker to tamper with.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.status(200).json({
    id: user.id,
    email: user.email,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
  });
}

/**
 * PATCH /api/users/me
 *
 * Mass-assignment protection: req.body has already been through updateProfileSchema
 * (via validateBody middleware), which strips any field not explicitly allow-listed.
 * Combined with scoping the update to req.user.sub, this also blocks privilege
 * escalation - there is no code path where a user-submitted request can change `role`.
 */
export async function updateMe(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const updates = req.body as UpdateProfileInput;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (updates.email && updates.email !== user.email) {
    const existing = await User.findOne({ email: updates.email });
    if (existing) {
      res.status(400).json({ message: 'Email is already in use' });
      return;
    }
    user.email = updates.email;
  }

  await user.save();
  await logAuditEvent({ req, action: 'profile.update', userId, metadata: { fields: Object.keys(updates) } });

  res.status(200).json({
    id: user.id,
    email: user.email,
    role: user.role,
    mfaEnabled: user.mfaEnabled,
  });
}
