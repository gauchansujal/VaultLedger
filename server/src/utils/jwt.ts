import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User.model';

export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  mfaVerified: boolean; // true only after MFA step is completed for accounts with MFA enabled
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number; // must match user.refreshTokenVersion or the token is considered revoked
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
}
