import dotenv from 'dotenv';
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  clientOrigin: required('CLIENT_ORIGIN'),

  mongoUri: required('MONGO_URI'),

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  fieldEncryptionKey: required('FIELD_ENCRYPTION_KEY'),

  mfaIssuer: process.env.MFA_ISSUER ?? 'VaultLedger',

  loginRateLimitWindowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS ?? 900000),
  loginRateLimitMaxAttempts: Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS ?? 5),
};

// Fail fast: a 32-byte key must be exactly 64 hex chars for AES-256-GCM
if (!/^[0-9a-fA-F]{64}$/.test(env.fieldEncryptionKey)) {
  throw new Error(
    'FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one with: openssl rand -hex 32'
  );
}
