import { hashPassword, verifyPassword, isPasswordReused } from '../password';

describe('password hashing', () => {
  it('produces a different hash each time for the same input (unique salt)', async () => {
    const hash1 = await hashPassword('MySecurePass123!');
    const hash2 = await hashPassword('MySecurePass123!');

    // argon2 embeds a random salt per hash - two hashes of the identical plaintext
    // must never be equal, otherwise identical passwords would be trivially
    // identifiable across accounts just by comparing stored hashes.
    expect(hash1).not.toEqual(hash2);
  });

  it('produces an argon2id-tagged hash', async () => {
    const hash = await hashPassword('MySecurePass123!');
    // argon2id hashes always start with this prefix - confirms the correct variant
    // is actually being used, not silently falling back to argon2i/argon2d.
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a correct password against its own hash', async () => {
    const hash = await hashPassword('MySecurePass123!');
    await expect(verifyPassword(hash, 'MySecurePass123!')).resolves.toBe(true);
  });

  it('rejects an incorrect password against a valid hash', async () => {
    const hash = await hashPassword('MySecurePass123!');
    await expect(verifyPassword(hash, 'WrongPassword!')).resolves.toBe(false);
  });

  it('does not throw on a malformed hash, returns false instead', async () => {
    // This matters because a thrown exception here could crash the login request
    // handler (or worse, be caught by a generic error handler that responds
    // differently than the normal "wrong password" path, creating a timing/response
    // oracle). Malformed input must fail the same way bad input does.
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });
});

describe('password reuse detection', () => {
  it('flags a password that matches an entry in history', async () => {
    const oldHash = await hashPassword('OldPassword123!');
    const reused = await isPasswordReused('OldPassword123!', [oldHash]);
    expect(reused).toBe(true);
  });

  it('does not flag a genuinely new password', async () => {
    const oldHash = await hashPassword('OldPassword123!');
    const reused = await isPasswordReused('BrandNewPassword456!', [oldHash]);
    expect(reused).toBe(false);
  });

  it('checks against every entry in a multi-item history', async () => {
    const hashes = await Promise.all(
      ['First111!', 'Second222!', 'Third333!'].map((p) => hashPassword(p))
    );
    await expect(isPasswordReused('Second222!', hashes)).resolves.toBe(true);
    await expect(isPasswordReused('NeverUsed999!', hashes)).resolves.toBe(false);
  });

  it('returns false for an empty history (new account, nothing to compare against)', async () => {
    await expect(isPasswordReused('AnyPassword123!', [])).resolves.toBe(false);
  });
});
