import argon2 from 'argon2';

// argon2id is the hybrid variant recommended by OWASP - resistant to both
// GPU cracking (like argon2i) and side-channel attacks (like argon2d).
// Parameters below follow OWASP's minimum recommendation for argon2id (2024 guidance):
// memoryCost >= 19456 KiB (~19 MB), timeCost >= 2, parallelism = 1.
// Tuned slightly above minimum since this app doesn't need to handle huge concurrent login volume.
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // argon2.verify throws on malformed hash rather than returning false - normalize it
    return false;
  }
}

/**
 * Checks a candidate new password against the user's recent password history.
 * Returns true if the new password matches any of the last N hashes (i.e. reuse is
 * blocked). This has to check every hash individually (argon2 hashes can't be compared
 * directly, only verified against a plaintext) - acceptable cost since history is
 * capped at a small number (env.passwordHistoryLimit).
 */
export async function isPasswordReused(newPlainPassword: string, history: string[]): Promise<boolean> {
  for (const oldHash of history) {
    if (await verifyPassword(oldHash, newPlainPassword)) {
      return true;
    }
  }
  return false;
}
