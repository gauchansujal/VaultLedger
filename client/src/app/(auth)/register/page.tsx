'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const allRulesMet = rules.every((r) => r.test(password));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!allRulesMet) {
      setError('Please meet all password requirements below.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/register', { email, password });
      router.push('/login?registered=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <VaultMark className="mb-4" />
          <h1 className="font-display text-2xl font-semibold text-vault-text">Create your vault</h1>
          <p className="text-vault-textMuted text-sm mt-1">Your data, encrypted from day one</p>
        </div>

        <form onSubmit={handleSubmit} className="vault-card p-6 space-y-4">
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="vault-input"
              placeholder="••••••••••••"
            />
            <ul className="mt-2.5 space-y-1">
              {rules.map((rule) => {
                const met = rule.test(password);
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-vault-textMuted mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-vault-gold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
