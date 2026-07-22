import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import { User } from '../models/User.model';
import { logAuditEvent } from '../utils/auditLogger';
import { UpdateProfileInput } from '../utils/validation/user.schema';

const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
const AVATAR_DIMENSION = 256; // square, px - fixed output size regardless of input

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
    avatarUrl: user.avatarUrl,
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
    avatarUrl: user.avatarUrl,
    mfaEnabled: user.mfaEnabled,
  });
}

/**
 * PATCH /api/users/me/avatar
 *
 * Security notes:
 * - multer's fileFilter already rejected obviously-wrong Content-Types before this runs,
 *   but that header is client-supplied and not trustworthy on its own.
 * - sharp() here is the real gate: it parses the actual file bytes. If the upload isn't
 *   a genuine, decodable image (e.g. a renamed script, a corrupted/malicious file, an
 *   image-polyglot payload), decoding throws and we reject with 400 - nothing invalid
 *   ever reaches disk.
 * - Re-encoding to a fixed-size JPEG strips ALL original metadata (EXIF/GPS/ICC profiles,
 *   any embedded payloads riding along in those chunks) as a side effect of the re-encode -
 *   we don't need to hunt for and strip specific metadata fields individually.
 * - The stored filename is a random UUID, not derived from the original filename or any
 *   client input - eliminates path traversal and filename-injection risk entirely.
 * - The old avatar file (if any) is deleted after the new one is confirmed written, so
 *   orphaned files don't accumulate on disk.
 */
export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const file = req.file;

  if (!file) {
    res.status(400).json({ message: 'No image file provided' });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  let processedBuffer: Buffer;
  try {
    processedBuffer = await sharp(file.buffer)
      .rotate() // auto-orient based on EXIF *before* that EXIF data is stripped below
      .resize(AVATAR_DIMENSION, AVATAR_DIMENSION, { fit: 'cover' })
      .jpeg({ quality: 85 }) // re-encoding to a fresh JPEG strips all original metadata
      .toBuffer();
  } catch {
    // sharp couldn't decode this as a real image - reject regardless of what the
    // client claimed its Content-Type was.
    res.status(400).json({ message: 'The uploaded file is not a valid image' });
    return;
  }

  await fs.mkdir(AVATAR_DIR, { recursive: true });

  const filename = `${crypto.randomUUID()}.jpg`;
  const filePath = path.join(AVATAR_DIR, filename);
  await fs.writeFile(filePath, processedBuffer);

  const previousAvatarUrl = user.avatarUrl;

  user.avatarUrl = `/uploads/avatars/${filename}`;
  await user.save();

  // Clean up the old file now that the new one is safely written and saved.
  if (previousAvatarUrl) {
    const previousFilename = path.basename(previousAvatarUrl);
    const previousPath = path.join(AVATAR_DIR, previousFilename);
    await fs.unlink(previousPath).catch(() => {
      // Non-fatal - an orphaned old avatar file is a minor cleanup issue, not worth
      // failing the request over.
    });
  }

  await logAuditEvent({ req, action: 'profile.avatar.update', userId });

  res.status(200).json({ avatarUrl: user.avatarUrl });
}
