'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type {
  AdminUser,
  AdminUserListResponse,
  AdminTransaction,
  AdminTransactionListResponse,
  UserProfile,
} from '@/lib/types';
import { Avatar } from '@/components/Avatar';

const roleOptions: AdminUser['role'][] = ['user', 'household-admin', 'system-admin'];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export default function AdminPanelPage() {
  const router = useRouter();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState<'users' | 'transactions'>('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [busyTransactionId, setBusyTransactionId] = useState<string | null>(null);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await api.get<UserProfile>('/api/users/me');
        setMe(meRes);

        if (meRes.role !== 'system-admin') {
          router.push('/dashboard');
          return;
        }

        const usersRes = await api.get<AdminUserListResponse>('/api/admin/users');
        setUsers(usersRes.users);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load admin panel');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function loadTransactions() {
    try {
      const res = await api.get<AdminTransactionListResponse>('/api/admin/transactions');
      setTransactions(res.transactions);
      setTransactionsLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load transactions');
    }
  }

  function switchTab(next: 'users' | 'transactions') {
    setTab(next);
    setError(null);
    if (next === 'transactions' && !transactionsLoaded) {
      loadTransactions();
    }
  }

  async function handleRoleChange(userId: string, role: AdminUser['role']) {
    setBusyUserId(userId);
    setError(null);
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role');
    } finally {
      setBusyUserId(null);
    }
  }

  function startEdit(user: AdminUser) {
    setEditingUserId(user.id);
    setEditEmail(user.email);
  }

  async function saveEdit(userId: string) {
    setBusyUserId(userId);
    setError(null);
    try {
      await api.patch(`/api/admin/users/${userId}`, { email: editEmail });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, email: editEmail } : u)));
      setEditingUserId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update email');
    } finally {
      setBusyUserId(null);
    }
  }

  async function confirmDeleteUser(userId: string) {
    setBusyUserId(userId);
    setError(null);
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmDeleteUserId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete user');
    } finally {
      setBusyUserId(null);
    }
  }

  async function confirmDeleteTransaction(txId: string) {
    setBusyTransactionId(txId);
    setError(null);
    try {
      await api.delete(`/api/admin/transactions/${txId}`);
      setTransactions((prev) => prev.filter((t) => t.id !== txId));
      setConfirmDeleteTxId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete transaction');
    } finally {
      setBusyTransactionId(null);
    }
  }

  if (loading) {
    return <p className="text-vault-textMuted text-sm">Loading…</p>;
  }

  if (!me || me.role !== 'system-admin') {
    return null;
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-vault-text">Admin Panel</h1>
      <p className="text-vault-textMuted text-sm mt-1 mb-6">
        Manage users and transactions. All changes here are recorded in the audit trail.
      </p>

      <div className="flex gap-1 mb-6 border-b border-vault-border">
        <button
          onClick={() => switchTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'users'
              ? 'border-vault-gold text-vault-gold'
              : 'border-transparent text-vault-textMuted hover:text-vault-text'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => switchTab('transactions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'transactions'
              ? 'border-vault-gold text-vault-gold'
              : 'border-transparent text-vault-textMuted hover:text-vault-text'
          }`}
        >
          All Transactions
        </button>
      </div>

      {error && (
        <p className="text-vault-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      {tab === 'users' && (
        <div className="vault-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-vault-border text-left">
                <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                  User
                </th>
                <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                  Role
                </th>
                <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                  MFA
                </th>
                <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide" />
              </tr>
            </thead>
            <tbody className="divide-y divide-vault-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar avatarUrl={user.avatarUrl} email={user.email} size={32} />
                      {editingUserId === user.id ? (
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="vault-input py-1 text-xs w-48"
                        />
                      ) : (
                        <span className="text-vault-text font-mono text-xs">{user.email}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {user.id === me.id ? (
                      <span className="text-vault-textMuted text-xs italic">You</span>
                    ) : (
                      <select
                        value={user.role}
                        disabled={busyUserId === user.id}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as AdminUser['role'])}
                        className="vault-input py-1.5 text-xs w-40"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {user.mfaEnabled ? (
                      <span className="text-xs text-vault-teal">Enabled</span>
                    ) : (
                      <span className="text-xs text-vault-textMuted">Off</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {user.isLocked ? (
                      <span className="text-xs text-vault-danger">Locked</span>
                    ) : (
                      <span className="text-xs text-vault-teal">Active</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {editingUserId === user.id ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => saveEdit(user.id)}
                          disabled={busyUserId === user.id}
                          className="text-vault-teal text-xs font-medium hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="text-vault-textMuted text-xs hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : user.id === me.id ? null : confirmDeleteUserId === user.id ? (
                      <div className="flex gap-2 justify-end items-center">
                        <span className="text-vault-danger text-xs">Delete this user?</span>
                        <button
                          onClick={() => confirmDeleteUser(user.id)}
                          disabled={busyUserId === user.id}
                          className="text-vault-danger text-xs font-medium hover:underline"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteUserId(null)}
                          className="text-vault-textMuted text-xs hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => startEdit(user)}
                          className="text-vault-textMuted text-xs hover:text-vault-text"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDeleteUserId(user.id)}
                          className="text-vault-textMuted text-xs hover:text-vault-danger"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'transactions' && (
        <div className="vault-card overflow-hidden">
          {transactions.length === 0 ? (
            <p className="text-vault-textMuted text-sm p-6 text-center">No transactions found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-vault-border text-left">
                  <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                    Owner
                  </th>
                  <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                    Category
                  </th>
                  <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody className="divide-y divide-vault-border">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-5 py-3 font-mono text-xs text-vault-textMuted">{tx.ownerEmail}</td>
                    <td className="px-5 py-3 text-vault-text capitalize">{tx.category}</td>
                    <td className="px-5 py-3 font-mono">
                      <span className={tx.type === 'income' ? 'text-vault-teal' : 'text-vault-text'}>
                        {tx.type === 'income' ? '+' : '−'}
                        {formatCurrency(tx.amount, tx.currency)}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-vault-textMuted">
                      {new Date(tx.occurredAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {confirmDeleteTxId === tx.id ? (
                        <div className="flex gap-2 justify-end items-center">
                          <button
                            onClick={() => confirmDeleteTransaction(tx.id)}
                            disabled={busyTransactionId === tx.id}
                            className="text-vault-danger text-xs font-medium hover:underline"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmDeleteTxId(null)}
                            className="text-vault-textMuted text-xs hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteTxId(tx.id)}
                          className="text-vault-textMuted text-xs hover:text-vault-danger"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
