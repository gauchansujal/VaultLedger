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

  // Email - if smtpHost is unset, mailer.ts falls back to console logging (dev-safe default)
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  mailFrom: process.env.MAIL_FROM ?? 'VaultLedger <no-reply@vaultledger.local>',

  // Password reset tokens are single-use and short-lived by design
  passwordResetTokenExpiresMinutes: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES ?? 30),

  // IP allow/block-listing - comma-separated IPs, empty = feature disabled (fail open,
  // not fail closed, so a misconfiguration doesn't accidentally lock out the whole app)
  ipBlocklist: (process.env.IP_BLOCKLIST ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
  adminIpAllowlist: (process.env.ADMIN_IP_ALLOWLIST ?? '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
};

// Fail fast: a 32-byte key must be exactly 64 hex chars for AES-256-GCM
if (!/^[0-9a-fA-F]{64}$/.test(env.fieldEncryptionKey)) {
  throw new Error(
    'FIELD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one with: openssl rand -hex 32'
  );
}
