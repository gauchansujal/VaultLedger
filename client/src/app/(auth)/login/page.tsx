'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { VaultMark } from '@/components/VaultMark';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body = mfaRequired ? { email, password, mfaToken } : { email, password };
      const res = await api.post<{ message: string; mfaRequired?: boolean }>('/api/auth/login', body);

      if (res.mfaRequired) {
        setMfaRequired(true);
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <VaultMark className="mb-4" />
          <h1 className="font-display text-2xl font-semibold text-vault-text">VaultLedger</h1>
          <p className="text-vault-textMuted text-sm mt-1">Sign in to your vault</p>
        </div>

        <form onSubmit={handleSubmit} className="vault-card p-6 space-y-4">
          {!mfaRequired ? (
            <>
              <div>
                <label htmlFor="email" className="vault-label">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="vault-input"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="vault-label">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="vault-input"
                  placeholder="••••••••••••"
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="mfaToken" className="vault-label">
                Enter the 6-digit code from your authenticator app
              </label>
              <input
                id="mfaToken"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={mfaToken}
                onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                className="vault-input font-mono text-lg tracking-[0.3em] text-center"
                placeholder="000000"
              />
            </div>
          )}

          {error && (
            <p className="text-vault-danger text-sm" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="vault-btn-primary w-full">
            {loading ? 'Verifying…' : mfaRequired ? 'Verify code' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-vault-textMuted mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-vault-gold hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
