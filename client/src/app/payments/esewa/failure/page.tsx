'use client';

import Link from 'next/link';
import { VaultMark } from '@/components/VaultMark';

export default function EsewaFailurePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <VaultMark className="mx-auto mb-6" />
        <div className="vault-card p-6">
          <p className="text-vault-danger text-sm mb-4">
            Payment was cancelled or did not complete.
          </p>
          <p className="text-vault-textMuted text-xs mb-4">
            No charge was made. The pending transaction has been recorded as failed in your account.
          </p>
          <Link href="/dashboard" className="vault-btn-secondary inline-block">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
