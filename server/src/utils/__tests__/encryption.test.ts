import { encryptField, decryptField } from '../encryption';

describe('field encryption (AES-256-GCM)', () => {
  it('decrypts back to the original plaintext', () => {
    const plaintext = '1234.56';
    const encrypted = encryptField(plaintext);
    expect(decryptField(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext each time for the same plaintext', () => {
    // A fresh random IV per encryption means identical inputs must NOT produce
    // identical ciphertext - otherwise an attacker with database access could
    // spot which encrypted transaction amounts are equal without ever decrypting
    // anything, which would leak information despite the encryption.
    const a = encryptField('100.00');
    const b = encryptField('100.00');
    expect(a).not.toEqual(b);
  });

  it('stores output in iv:authTag:ciphertext format', () => {
    const encrypted = encryptField('42.00');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
  });

  it('fails to decrypt if the ciphertext has been tampered with', () => {
    const encrypted = encryptField('999.99');
    const [iv, authTag, ciphertext] = encrypted.split(':');
    // Flip a character in the ciphertext portion, simulating a database-level
    // tamper attempt or corruption.
    const tamperedChar = ciphertext[0] === 'a' ? 'b' : 'a';
    const tampered = `${iv}:${authTag}:${tamperedChar}${ciphertext.slice(1)}`;

    // GCM's authentication tag must cause this to throw, not silently return
    // corrupted plaintext - this is the actual security property GCM provides
    // over a non-authenticated mode like plain CBC.
    expect(() => decryptField(tampered)).toThrow();
  });

  it('throws on a malformed stored value rather than silently failing', () => {
    expect(() => decryptField('not-the-right-format')).toThrow();
  });
});
