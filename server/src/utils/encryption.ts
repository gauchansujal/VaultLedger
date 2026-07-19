import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended IV length for GCM
const KEY = Buffer.from(env.fieldEncryptionKey, 'hex'); // 32 bytes

/**
 * Encrypts a plaintext string for storage. Output format: iv:authTag:ciphertext (all hex),
 * so it can be safely stored as a single string field in MongoDB.
 *
 * GCM is used (not plain CBC) because it provides both confidentiality AND integrity -
 * any tampering with the stored ciphertext will fail decryption rather than silently
 * returning corrupted data.
 */
export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptField(stored: string): string {
  const [ivHex, authTagHex, cipherHex] = stored.split(':');
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error('Malformed encrypted field value');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const cipherText = Buffer.from(cipherHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return decrypted.toString('utf8');
}
