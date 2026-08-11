import { Request, Response } from 'express';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { User } from '../models/User.model';
import { hashPassword, verifyPassword, isPasswordReused } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/jwt';
import { encryptField, decryptField } from '../utils/encryption';
import { logAuditEvent } from '../utils/auditLogger';
import { sendMail } from '../utils/mailer';
import { hashUserAgent } from '../utils/session';
import { env } from '../config/env';
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from '../utils/validation/auth.schema';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; 
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
    
    res.status(400).json({ message: 'Unable to register with the provided details' });
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    email,
    passwordHash,
    passwordChangedAt: new Date(),
    role: 'user', 
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

  const genericFail = () => res.status(401).json({ message: 'Invalid email or password' });

  if (!user) {
    genericFail();
    return;
  }


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

     
      await sendMail(
        user.email,
        'Security alert: your VaultLedger account was locked',
        `Your account was temporarily locked after ${MAX_FAILED_ATTEMPTS} failed login attempts, ` +
          `most recently from IP address ${req.ip ?? 'unknown'}.\n\n` +
          `If this wasn't you, we recommend resetting your password once the lock expires ` +
          `(in 15 minutes) using the "Forgot password" link on the sign-in page.\n\n` +
          `If this was you, you can simply try again in 15 minutes.`
      );

      genericFail();
      return;
    }

    await user.save();
    await logAuditEvent({ req, action: 'user.login.failed', userId: user.id });
    genericFail();
    return;
  }

  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
  }

  if (user.passwordChangedAt) {
    const ageMs = Date.now() - user.passwordChangedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays > env.passwordExpiryDays) {
      res.status(403).json({
        message: 'Your password has expired and must be reset before you can sign in.',
        passwordExpired: true,
      });
      return;
    }
  }

  if (user.mfaEnabled) {
    if (!mfaToken) {
    
      res.status(200).json({ mfaRequired: true });
      return;
    }

    const decryptedSecret = decryptField(user.mfaSecret as string);
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: mfaToken,
      window: 1, 
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
    userAgentHash: hashUserAgent(req),
  });

  res
    .cookie('accessToken', accessToken, cookieOptions(15 * 60 * 1000))
    .cookie('refreshToken', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000))
    .status(200)
    .json({ message: 'Login successful' });

  await logAuditEvent({ req, action: 'user.login.success', userId: user.id });
}

export async function logout(req: Request, res: Response): Promise<void> {

  const token = req.cookies?.accessToken;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      await logAuditEvent({ req, action: 'user.logout', userId: payload.sub });
    } catch {
      
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
      
      res.status(401).json({ message: 'Refresh token is no longer valid' });
      return;
    }

    if (payload.userAgentHash !== hashUserAgent(req)) {
      await logAuditEvent({
        req,
        action: 'user.session.binding_mismatch',
        userId: user.id,
      });
      res.status(401).json({ message: 'Session could not be verified. Please sign in again.' });
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

  const genericResponse = () =>
    res.status(200).json({
      message: 'If an account exists for that email, a password reset link has been sent.',
    });

  if (!user) {
    genericResponse();
    return;
  }

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
  }).select('+passwordResetTokenHash +passwordResetExpires +passwordHash +passwordHistory');

  if (!user) {
  
    res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    return;
  }

  if (await isPasswordReused(newPassword, [user.passwordHash, ...user.passwordHistory])) {
    res.status(400).json({
      message: `You've used this password recently. Please choose a different one.`,
    });
    return;
  }


  user.passwordHistory = [user.passwordHash, ...user.passwordHistory].slice(0, env.passwordHistoryLimit);

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;

  
  user.refreshTokenVersion += 1;

  await user.save();

  await logAuditEvent({ req, action: 'user.password.reset_completed', userId: user.id });

  res.status(200).json({ message: 'Password reset successfully. Please sign in with your new password.' });
}


export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user?.sub;
  const { currentPassword, newPassword } = req.body as ChangePasswordInput;

  const user = await User.findById(userId).select('+passwordHash +passwordHistory');
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const currentValid = await verifyPassword(user.passwordHash, currentPassword);
  if (!currentValid) {
    res.status(401).json({ message: 'Current password is incorrect' });
    return;
  }

  if (await isPasswordReused(newPassword, [user.passwordHash, ...user.passwordHistory])) {
    res.status(400).json({
      message: `You've used this password recently. Please choose a different one.`,
    });
    return;
  }

  user.passwordHistory = [user.passwordHash, ...user.passwordHistory].slice(0, env.passwordHistoryLimit);
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();


  user.refreshTokenVersion += 1;

  await user.save();

  await logAuditEvent({ req, action: 'user.password.reset_completed', userId: user.id });

  res.status(200).json({ message: 'Password changed successfully' });
}
