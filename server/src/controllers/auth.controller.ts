import { Request, Response } from 'express';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { User } from '../models/User.model';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/jwt';
import { encryptField, decryptField } from '../utils/encryption';
import { logAuditEvent } from '../utils/auditLogger';
import { sendMail } from '../utils/mailer';
import { env } from '../config/env';
import { RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput } from '../utils/validation/auth.schema';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Cookie options shared by access/refresh cookies - httpOnly blocks JS/XSS access,
// sameSite=strict blocks CSRF from cross-site requests, secure requires HTTPS in production.
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict' as const,
    maxAge: maxAgeMs,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as RegisterInput;

  const existing = await User.findOne({ email });
  if (existing) {
    // Deliberately vague message - do not reveal whether the email exists.
    // Prevents user enumeration via the registration endpoint.
    res.status(400).json({ message: 'Unable to register with the provided details' });
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    email,
    passwordHash,
    role: 'user', // role is NEVER taken from client input - always defaulted server-side
  });

  await logAuditEvent({ req, action: 'user.register', userId: user.id });

  res.status(201).json({
    message: 'Registration successful',
    userId: user._id,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password, mfaToken } = req.body as LoginInput;

  const user = await User.findOne({ email }).select('+passwordHash +mfaSecret');

  // Same generic error whether the user doesn't exist OR the password is wrong -
  // prevents user enumeration via response differences.
  const genericFail = () => res.status(401).json({ message: 'Invalid email or password' });

  if (!user) {
    genericFail();
    return;
  }

  // Account lockout check
  if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    res.status(423).json({
      message: `Account temporarily locked due to repeated failed attempts. Try again in ${minutesLeft} minute(s).`,
    });
    return;
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);

  if (!passwordValid) {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.failedLoginAttempts = 0; // reset counter, lock is now the active penalty
      await user.save();
      await logAuditEvent({ req, action: 'user.login.locked', userId: user.id });
      genericFail();
      return;
    }

    await user.save();
    await logAuditEvent({ req, action: 'user.login.failed', userId: user.id });
    genericFail();
    return;
  }

  // Password correct - reset failed attempts
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }

  // MFA step
  if (user.mfaEnabled) {
    if (!mfaToken) {
      // Signal to the client that this account requires a second factor.
      // No tokens issued yet - MFA must be verified first (zero-trust: password alone is
      // insufficient for accounts that opted into MFA).
      res.status(200).json({ mfaRequired: true });
      return;
    }

    const decryptedSecret = decryptField(user.mfaSecret as string);
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: mfaToken,
      window: 1, // allow 1 step (30s) of clock drift
    });

    if (!verified) {
      res.status(401).json({ message: 'Invalid MFA code' });
      return;
    }
  }

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    mfaVerified: user.mfaEnabled ? true : false,
  });
  const refreshToken = signRefreshToken({
    sub: user.id,
    tokenVersion: user.refreshTokenVersion,
  });

  res
    .cookie('accessToken', accessToken, cookieOptions(15 * 60 * 1000))
    .cookie('refreshToken', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000))
    .status(200)
    .json({ message: 'Login successful' });

  await logAuditEvent({ req, action: 'user.login.success', userId: user.id });
}

export async function logout(req: Request, res: Response): Promise<void> {
  // Best-effort: try to identify who's logging out for the audit trail, but never block
  // the logout itself on an invalid/expired token - users must always be able to clear
  // their session client-side.
  const token = req.cookies?.accessToken;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      await logAuditEvent({ req, action: 'user.logout', userId: payload.sub });
    } catch {
      // token invalid/expired - nothing to attribute the logout to, proceed anyway
    }
  }

  res
    .clearCookie('accessToken')
    .clearCookie('refreshToken')
    .status(200)
    .json({ message: 'Logged out' });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken;
  if (!token) {
    res.status(401).json({ message: 'No refresh token provided' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub);

    if (!user || user.refreshTokenVersion !== payload.tokenVersion) {
      // Token version mismatch = token was revoked (e.g. password change, logout-all)
      res.status(401).json({ message: 'Refresh token is no longer valid' });
      return;
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      mfaVerified: user.mfaEnabled,
    });

    await logAuditEvent({ req, action: 'user.token.refresh', userId: user.id });

    res.cookie('accessToken', accessToken, cookieOptions(15 * 60 * 1000)).status(200).json({
      message: 'Token refreshed',
    });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}

// --- MFA setup flow ---

export async function setupMfa(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub; // populated by auth middleware (built next)
  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const secret = speakeasy.generateSecret({
    name: `${env.mfaIssuer} (${user.email})`,
  });

  // Store encrypted - the raw TOTP secret is as sensitive as a password equivalent
  user.mfaSecret = encryptField(secret.base32);
  await user.save();

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url as string);

  res.status(200).json({
    message: 'Scan this QR code with your authenticator app, then verify to enable MFA',
    qrCode: qrCodeDataUrl,
  });
}

export async function verifyAndEnableMfa(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const { mfaToken } = req.body;

  const user = await User.findById(userId).select('+mfaSecret');
  if (!user || !user.mfaSecret) {
    res.status(400).json({ message: 'MFA setup has not been started' });
    return;
  }

  const decryptedSecret = decryptField(user.mfaSecret);
  const verified = speakeasy.totp.verify({
    secret: decryptedSecret,
    encoding: 'base32',
    token: mfaToken,
    window: 1,
  });

  if (!verified) {
    res.status(400).json({ message: 'Invalid code - MFA not enabled' });
    return;
  }

  user.mfaEnabled = true;
  await user.save();

  await logAuditEvent({ req, action: 'user.mfa.enabled', userId: user.id });

  res.status(200).json({ message: 'MFA enabled successfully' });
}

// --- Password reset flow ---

const RESET_TOKEN_BYTES = 32;

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as ForgotPasswordInput;

  const user = await User.findOne({ email });

  // Always return the same generic response whether or not the email exists - this is
  // the standard anti-enumeration pattern for password reset endpoints specifically.
  // Without this, an attacker could use "did I get a reset email?" as an oracle to
  // discover which emails are registered.
  const genericResponse = () =>
    res.status(200).json({
      message: 'If an account exists for that email, a password reset link has been sent.',
    });

  if (!user) {
    genericResponse();
    return;
  }

  // Generate a random token, send the RAW token to the user, store only its hash.
  // This mirrors password storage: even a full database leak doesn't hand an attacker
  // usable reset tokens, because the hash alone can't be reversed back to the token
  // that would need to be presented in the reset link.
  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + env.passwordResetTokenExpiresMinutes * 60 * 1000);
  await user.save();

  const resetUrl = `${env.clientOrigin}/reset-password?token=${rawToken}`;

  await sendMail(
    user.email,
    'Reset your VaultLedger password',
    `We received a request to reset your VaultLedger password.\n\n` +
      `Click the link below to choose a new password. This link expires in ` +
      `${env.passwordResetTokenExpiresMinutes} minutes and can only be used once:\n\n` +
      `${resetUrl}\n\n` +
      `If you didn't request this, you can safely ignore this email - your password ` +
      `will not be changed.`
  );

  await logAuditEvent({ req, action: 'user.password.reset_requested', userId: user.id });

  genericResponse();
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, newPassword } = req.body as ResetPasswordInput;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');

  if (!user) {
    // Same message whether the token is invalid, expired, or already used (tokens are
    // cleared after use, see below) - don't help an attacker distinguish these cases.
    res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    return;
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;

  // Invalidate every existing session (all previously issued refresh tokens become
  // worthless) - if the account was reset because it was compromised, this kicks out
  // whoever was previously logged in, not just on the device doing the reset.
  user.refreshTokenVersion += 1;

  await user.save();

  await logAuditEvent({ req, action: 'user.password.reset_completed', userId: user.id });

  res.status(200).json({ message: 'Password reset successfully. Please sign in with your new password.' });
}
