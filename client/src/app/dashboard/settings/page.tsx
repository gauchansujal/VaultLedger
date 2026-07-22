'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import type { UserProfile } from '@/lib/types';
import { Avatar } from '@/components/Avatar';

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB - must match server limit

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);

  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<UserProfile>('/api/users/me');
        setProfile(res);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    // Client-side checks are a UX convenience only - the server re-validates and
    // re-encodes every upload regardless, so these checks are not a security boundary.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Please choose a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Image must be smaller than 2MB.');
      return;
    }

    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.upload<{ avatarUrl: string }>('/api/users/me/avatar', formData);
      setProfile((p) => (p ? { ...p, avatarUrl: res.avatarUrl } : p));
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function startMfaSetup() {
    setMfaError(null);
    setMfaBusy(true);
    try {
      const res = await api.post<{ qrCode: string }>('/api/auth/mfa/setup');
      setQrCode(res.qrCode);
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : 'Failed to start MFA setup');
    } finally {
      setMfaBusy(false);
    }
  }

  async function verifyMfa(e: FormEvent) {
    e.preventDefault();
    setMfaError(null);
    setMfaBusy(true);
    try {
      await api.post('/api/auth/mfa/verify', { mfaToken });
      setMfaSuccess(true);
      setQrCode(null);
      setProfile((p) => (p ? { ...p, mfaEnabled: true } : p));
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : 'Invalid code');
    } finally {
      setMfaBusy(false);
    }
  }

  if (loading) {
    return <p className="text-vault-textMuted text-sm">Loading…</p>;
  }

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl font-semibold text-vault-text mb-8">Settings</h1>

      <section className="vault-card p-5 mb-6">
        <h2 className="font-display font-semibold text-vault-text mb-4">Profile</h2>

        <div className="flex items-center gap-4 mb-5">
          <Avatar avatarUrl={profile?.avatarUrl} email={profile?.email ?? ''} size={64} />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarSelect}
              className="hidden"
              id="avatar-input"
            />
            <label
              htmlFor="avatar-input"
              className="vault-btn-secondary cursor-pointer inline-block text-sm"
            >
              {avatarUploading ? 'Uploading…' : 'Change photo'}
            </label>
            <p className="text-vault-textMuted text-xs mt-1.5">JPEG, PNG, or WEBP. Max 2MB.</p>
            {avatarError && <p className="text-vault-danger text-xs mt-1">{avatarError}</p>}
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-vault-textMuted">Email</dt>
            <dd className="text-vault-text font-mono">{profile?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-vault-textMuted">Role</dt>
            <dd className="text-vault-text capitalize">{profile?.role}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-vault-textMuted">Member since</dt>
            <dd className="text-vault-text font-mono">
              {profile && new Date(profile.createdAt).toLocaleDateString('en-GB')}
            </dd>
          </div>
        </dl>
      </section>

      <section className="vault-card p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold text-vault-text">Two-factor authentication</h2>
          {profile?.mfaEnabled && (
            <span className="text-xs font-medium text-vault-teal bg-vault-teal/10 px-2 py-1 rounded">
              Enabled
            </span>
          )}
        </div>
        <p className="text-vault-textMuted text-sm mb-4">
          Require a 6-digit code from an authenticator app every time you sign in.
        </p>

        {profile?.mfaEnabled ? (
          <p className="text-vault-teal text-sm">✓ Your account is protected with two-factor authentication.</p>
        ) : mfaSuccess ? (
          <p className="text-vault-teal text-sm">✓ Two-factor authentication enabled successfully.</p>
        ) : qrCode ? (
          <form onSubmit={verifyMfa} className="space-y-4">
            <div className="bg-white p-3 rounded-vault w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="Scan this QR code with your authenticator app" width={180} height={180} />
            </div>
            <p className="text-vault-textMuted text-xs">
              Scan with Google Authenticator, Authy, or similar, then enter the code it shows.
            </p>
            <div>
              <label className="vault-label">6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                className="vault-input font-mono text-lg tracking-[0.3em] text-center w-40"
                placeholder="000000"
              />
            </div>
            {mfaError && <p className="text-vault-danger text-sm">{mfaError}</p>}
            <button type="submit" disabled={mfaBusy} className="vault-btn-primary">
              {mfaBusy ? 'Verifying…' : 'Verify and enable'}
            </button>
          </form>
        ) : (
          <>
            {mfaError && <p className="text-vault-danger text-sm mb-3">{mfaError}</p>}
            <button onClick={startMfaSetup} disabled={mfaBusy} className="vault-btn-secondary">
              {mfaBusy ? 'Starting…' : 'Set up two-factor authentication'}
            </button>
          </>
        )}
      </section>

      {profile?.role === 'system-admin' && (
        <section className="vault-card p-5">
          <h2 className="font-display font-semibold text-vault-text mb-2">Administration</h2>
          <p className="text-vault-textMuted text-sm mb-4">
            You have system-admin access. Manage users and roles from the admin panel.
          </p>
          <Link href="/dashboard/admin" className="vault-btn-secondary inline-block">
            Open admin panel
          </Link>
        </section>
      )}
    </div>
  );
}

