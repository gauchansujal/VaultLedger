'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { VaultMark } from '@/components/VaultMark';
import { Avatar } from '@/components/Avatar';
import type { UserProfile } from '@/lib/types';

const baseNavItems = [
  { href: '/dashboard', label: 'Transactions' },
  { href: '/dashboard/vault', label: 'Transparency Vault' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    api
      .get<UserProfile>('/api/users/me')
      .then(setProfile)
      .catch(() => {
        // Not authenticated (or session expired) - send back to login rather than
        // leaving a broken dashboard shell on screen.
        router.push('/login');
      });
  }, [router]);

  async function handleLogout() {
    await api.post('/api/auth/logout');
    router.push('/login');
  }

  const navItems =
    profile?.role === 'system-admin'
      ? [...baseNavItems, { href: '/dashboard/admin', label: 'Admin Panel' }]
      : baseNavItems;

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-vault-border bg-vault-surface flex flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-vault-border">
          <VaultMark className="w-8 h-8" />
          <span className="font-display font-semibold text-vault-text">VaultLedger</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-vault text-sm font-medium transition-colors ${
                  active
                    ? 'bg-vault-surface2 text-vault-gold'
                    : 'text-vault-textMuted hover:text-vault-text hover:bg-vault-surface2'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-vault-border">
          {profile && (
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2.5 px-2 py-2 rounded-vault hover:bg-vault-surface2 transition-colors mb-1"
            >
              <Avatar avatarUrl={profile.avatarUrl} email={profile.email} size={28} />
              <span className="text-vault-textMuted text-xs font-mono truncate">{profile.email}</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-2 py-2 rounded-vault text-sm font-medium text-vault-textMuted hover:text-vault-danger hover:bg-vault-surface2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-8 py-8 max-w-4xl">{children}</main>
    </div>
  );
}
