'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { AuditLogEntry, AuditLogResponse } from '@/lib/types';

const actionLabels: Record<string, string> = {
  'user.register': 'Account created',
  'user.login.success': 'Signed in',
  'user.login.failed': 'Failed sign-in attempt',
  'user.login.locked': 'Account locked (too many attempts)',
  'user.logout': 'Signed out',
  'user.mfa.enabled': 'Two-factor authentication enabled',
  'user.token.refresh': 'Session renewed',
  'profile.update': 'Profile updated',
  'transaction.create': 'Transaction created',
  'transaction.view': 'Transaction viewed',
  'transaction.update': 'Transaction updated',
  'transaction.delete': 'Transaction deleted',
};

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function severityColor(action: string) {
  if (action.includes('failed') || action.includes('locked')) return 'text-vault-danger';
  if (action.includes('success') || action.includes('enabled')) return 'text-vault-teal';
  return 'text-vault-text';
}

export default function TransparencyVaultPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get<AuditLogResponse>('/api/audit-log/me');
        setEntries(res.entries);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-vault-text">Transparency Vault</h1>
      <p className="text-vault-textMuted text-sm mt-1 mb-8 max-w-xl">
        Every action taken on your account, recorded here permanently. This log cannot be edited
        or deleted &mdash; not even by an administrator.
      </p>

      {error && (
        <p className="text-vault-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-vault-textMuted text-sm">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="vault-card p-8 text-center">
          <p className="text-vault-textMuted text-sm">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="vault-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vault-border text-left">
                <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                  Timestamp
                </th>
                <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                  Action
                </th>
                <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-border">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-5 py-3 font-mono text-xs text-vault-textMuted whitespace-nowrap">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td className={`px-5 py-3 font-medium ${severityColor(entry.action)}`}>
                    {actionLabels[entry.action] ?? entry.action}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-vault-textMuted">
                    {entry.ipAddress}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
