'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { VaultMark } from '@/components/VaultMark';

const rules = [
  { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const allRulesMet = rules.every((r) => r.test(newPassword));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('This reset link is missing its token. Please request a new one.');
      return;
    }
    if (!allRulesMet) {
      setError('Please meet all password requirements below.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <VaultMark className="mb-4" />
          <h1 className="font-display text-2xl font-semibold text-vault-text">Choose a new password</h1>
        </div>

        {!token ? (
          <div className="vault-card p-6 text-center">
            <p className="text-vault-danger text-sm">
              This reset link is invalid or missing its token.
            </p>
            <Link href="/forgot-password" className="text-vault-gold text-sm hover:underline mt-3 inline-block">
              Request a new reset link
            </Link>
          </div>
        ) : success ? (
          <div className="vault-card p-6 text-center">
            <p className="text-vault-teal text-sm">✓ Password reset successfully.</p>
            <p className="text-vault-textMuted text-xs mt-2">Redirecting you to sign in…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="vault-card p-6 space-y-4">
            <div>
              <label htmlFor="newPassword" className="vault-label">New password</label>
              <input
                id="newPassword"
                type="password"
                required
                autoComplete="new-password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="vault-input"
                placeholder="••••••••••••"
              />
              <ul className="mt-2.5 space-y-1">
                {rules.map((rule) => {
                  const met = rule.test(newPassword);
                  return (
                    <li
                      key={rule.label}
                      className={`text-xs flex items-center gap-1.5 ${
                        met ? 'text-vault-teal' : 'text-vault-textMuted'
                      }`}
                    >
                      <span aria-hidden="true">{met ? '✓' : '·'}</span>
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            {error && (
              <p className="text-vault-danger text-sm" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="vault-btn-primary w-full">
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-vault-textMuted mt-6">
          <Link href="/login" className="text-vault-gold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams requires a Suspense boundary in Next.js App Router
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
