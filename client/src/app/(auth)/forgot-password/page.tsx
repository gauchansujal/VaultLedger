'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { VaultMark } from '@/components/VaultMark';

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get('expired') === '1';

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // The API always returns the same generic response whether or not the email
      // exists, so we always show the same "check your email" state here too -
      // showing anything different would undo the server's anti-enumeration protection.
      await api.post('/api/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <VaultMark className="mb-4" />
          <h1 className="font-display text-2xl font-semibold text-vault-text">Reset your password</h1>
          <p className="text-vault-textMuted text-sm mt-1 text-center">
            Enter your account email and we&apos;ll send you a reset link.
          </p>
        </div>

        {expired && !submitted && (
          <div className="bg-vault-gold/10 border border-vault-gold/30 rounded-vault px-4 py-3 mb-4">
            <p className="text-vault-gold text-xs">
              Your password has expired and must be reset before you can sign in again.
            </p>
          </div>
        )}

        {submitted ? (
          <div className="vault-card p-6 text-center">
            <p className="text-vault-teal text-sm">
              ✓ If an account exists for that email, a reset link has been sent.
            </p>
            <p className="text-vault-textMuted text-xs mt-2">
              The link expires in 30 minutes. Check your spam folder if it doesn&apos;t arrive shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="vault-card p-6 space-y-4">
            <div>
              <label htmlFor="email" className="vault-label">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="vault-input"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-vault-danger text-sm" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="vault-btn-primary w-full">
              {loading ? 'Sending…' : 'Send reset link'}
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

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
