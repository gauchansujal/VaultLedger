'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { VaultMark } from '@/components/VaultMark';

const navItems = [
  { href: '/dashboard', label: 'Transactions' },
  { href: '/dashboard/vault', label: 'Transparency Vault' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await api.post('/api/auth/logout');
    router.push('/login');
  }

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

        <div className="px-3 py-4 border-t border-vault-border">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-vault text-sm font-medium text-vault-textMuted hover:text-vault-danger hover:bg-vault-surface2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-8 py-8 max-w-4xl">{children}</main>
    </div>
  );
}
