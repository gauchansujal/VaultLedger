'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { VaultMark } from '@/components/VaultMark';

function EsewaSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'completed' | 'failed' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function verify() {
      const dataParam = searchParams.get('data');
      if (!dataParam) {
        setStatus('error');
        setMessage('No payment data received from eSewa.');
        return;
      }

      try {
        // eSewa's v2 redirect encodes the transaction outcome as base64 JSON in the
        // 'data' query param - this is what tells us WHICH transaction to verify.
        // We still don't trust the CONTENT of this data for the actual pass/fail
        // decision (see verifyEsewaTransaction on the server) - it's only used here
        // to know which transactionUuid to ask the server to independently verify.
        const decoded = JSON.parse(atob(dataParam));
        const transactionUuid = decoded.transaction_uuid;

        if (!transactionUuid) {
          setStatus('error');
          setMessage('Payment data was missing a transaction reference.');
          return;
        }

        const res = await api.post<{ paymentStatus: string }>('/api/payments/esewa/verify', {
          transactionUuid,
        });

        if (res.paymentStatus === 'completed') {
          setStatus('completed');
        } else {
          setStatus('failed');
          setMessage('eSewa did not confirm this payment as complete.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof ApiError ? err.message : 'Could not verify payment.');
      }
    }
    verify();
  }, [searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <VaultMark className="mx-auto mb-6" />

        {status === 'verifying' && (
          <>
            <h1 className="font-display text-xl font-semibold text-vault-text mb-2">
              Verifying your payment…
            </h1>
            <p className="text-vault-textMuted text-sm">
              Checking with eSewa directly - this only takes a moment.
            </p>
          </>
        )}

        {status === 'completed' && (
          <div className="vault-card p-6">
            <p className="text-vault-teal text-sm mb-4">✓ Payment verified and recorded.</p>
            <button onClick={() => router.push('/dashboard')} className="vault-btn-primary w-full">
              Back to dashboard
            </button>
          </div>
        )}

        {(status === 'failed' || status === 'error') && (
          <div className="vault-card p-6">
            <p className="text-vault-danger text-sm mb-4">{message || 'Payment could not be verified.'}</p>
            <Link href="/dashboard" className="vault-btn-secondary inline-block">
              Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function EsewaSuccessPage() {
  return (
    <Suspense fallback={null}>
      <EsewaSuccessContent />
    </Suspense>
  );
}
