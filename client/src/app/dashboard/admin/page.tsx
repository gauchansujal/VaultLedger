'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { AdminUser, AdminUserListResponse, UserProfile } from '@/lib/types';
import { Avatar } from '@/components/Avatar';

const roleOptions: AdminUser['role'][] = ['user', 'household-admin', 'system-admin'];

export default function AdminPanelPage() {
  const router = useRouter();
  const [me, setMe] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Check role client-side for UX (hide the page), but this is NOT the security
        // boundary - the API itself rejects non-admins with 403 regardless of what the
        // frontend shows. See requireRole('system-admin') in admin.routes.ts.
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

  async function handleRoleChange(userId: string, role: AdminUser['role']) {
    setUpdatingUserId(userId);
    setError(null);
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role');
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (loading) {
    return <p className="text-vault-textMuted text-sm">Loading…</p>;
  }

  if (!me || me.role !== 'system-admin') {
    return null; // redirect already in flight
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-vault-text">Admin Panel</h1>
      <p className="text-vault-textMuted text-sm mt-1 mb-8">
        Manage users and roles. All changes here are recorded in the audit trail.
      </p>

      {error && (
        <p className="text-vault-danger text-sm mb-4" role="alert">
          {error}
        </p>
      )}

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
              <th className="px-5 py-3 font-medium text-vault-textMuted text-xs uppercase tracking-wide">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-vault-border">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar avatarUrl={user.avatarUrl} email={user.email} size={32} />
                    <span className="text-vault-text font-mono text-xs">{user.email}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {user.id === me.id ? (
                    <span className="text-vault-textMuted text-xs italic">You (locked)</span>
                  ) : (
                    <select
                      value={user.role}
                      disabled={updatingUserId === user.id}
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
                <td className="px-5 py-3 font-mono text-xs text-vault-textMuted">
                  {new Date(user.createdAt).toLocaleDateString('en-GB')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
