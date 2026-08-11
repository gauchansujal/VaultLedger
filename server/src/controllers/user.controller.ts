import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import { User } from '../models/User.model';
import { Transaction } from '../models/Transaction.model';
import { decryptField, encryptField } from '../utils/encryption';
import { logAuditEvent } from '../utils/auditLogger';
import { UpdateProfileInput, ImportTransactionsInput } from '../utils/validation/user.schema';

const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
const AVATAR_DIMENSION = 256; 
const MAX_IMPORT_ROWS = 500;


export async function exportMyData(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const transactions = await Transaction.find({ userId }).select('+amountEncrypted').sort({ occurredAt: -1 });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    profile: {
      email: user.email,
      role: user.role,
      mfaEnabled: user.mfaEnabled,
      createdAt: user.createdAt,
    },
    transactions: transactions.map((tx) => ({
      type: tx.type,
      category: tx.category,
      amount: Number(decryptField(tx.amountEncrypted)),
      currency: tx.currency,
      note: tx.note,
      occurredAt: tx.occurredAt,
    })),
  };

  await logAuditEvent({ req, action: 'profile.data_export', userId });

  res.setHeader('Content-Disposition', 'attachment; filename="vaultledger-export.json"');
  res.status(200).json(exportPayload);
}

export async function importTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const { transactions } = req.body as ImportTransactionsInput;

  if (transactions.length > MAX_IMPORT_ROWS) {
    res.status(400).json({ message: `Cannot import more than ${MAX_IMPORT_ROWS} transactions at once` });
    return;
  }

  const docs = transactions.map((tx) => ({
    userId,
    type: tx.type,
    category: tx.category,
    amountEncrypted: encryptField(String(tx.amount)),
    currency: tx.currency ?? 'GBP',
    note: tx.note,
    occurredAt: tx.occurredAt ?? new Date(),
  }));

  const created = await Transaction.insertMany(docs);

  await logAuditEvent({
    req,
    action: 'profile.data_import',
    userId,
    metadata: { importedCount: created.length },
  });

  res.status(201).json({ message: `Imported ${created.length} transaction(s)`, count: created.length });
}


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
      .rotate() 
      .resize(AVATAR_DIMENSION, AVATAR_DIMENSION, { fit: 'cover' })
      .jpeg({ quality: 85 }) 
      .toBuffer();
  } catch {
   
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

  
  if (previousAvatarUrl) {
    const previousFilename = path.basename(previousAvatarUrl);
    const previousPath = path.join(AVATAR_DIR, previousFilename);
    await fs.unlink(previousPath).catch(() => {
     
    });
  }

  await logAuditEvent({ req, action: 'profile.avatar.update', userId });

  res.status(200).json({ avatarUrl: user.avatarUrl });
}
