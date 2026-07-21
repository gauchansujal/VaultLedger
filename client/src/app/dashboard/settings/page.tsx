'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { UserProfile } from '@/lib/types';

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);

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

      <section className="vault-card p-5">
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
    </div>
  );
}
