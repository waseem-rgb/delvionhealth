'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Plus,
  Flag,
  CreditCard,
  ScrollText,
  ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Role } from '@delvion/types';

const NAV_ITEMS = [
  { label: 'Overview', href: '/super-admin', icon: LayoutDashboard },
  { label: 'Tenants', href: '/super-admin/tenants', icon: Building2 },
  { label: 'Provision', href: '/super-admin/provision', icon: Plus },
  { label: 'Feature Flags', href: '/super-admin/flags', icon: Flag },
  { label: 'Platform Billing', href: '/super-admin/billing', icon: CreditCard },
  { label: 'Audit Log', href: '/super-admin/audit', icon: ScrollText },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    // Rehydrate store from localStorage if not yet done
    void useAuthStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (user !== null && user?.role !== Role.SUPER_ADMIN) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#0A1628' }}>
      {/* Sidebar */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col h-screen fixed left-0 top-0 z-40"
        style={{ backgroundColor: '#0F1F3D' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ backgroundColor: '#0D9488' }}
          >
            SA
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">DELViON</p>
            <p className="text-xs leading-tight" style={{ color: '#94a3b8' }}>Super Admin</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/super-admin'
                ? pathname === '/super-admin'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: isActive ? '#0D9488' : 'transparent',
                  color: isActive ? '#ffffff' : '#94a3b8',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8';
                  }
                }}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-4 py-4 border-t space-y-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {user && (
            <p className="text-xs truncate px-1" style={{ color: '#64748b' }}>
              {user.email}
            </p>
          )}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all w-full"
            style={{ color: '#94a3b8' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLAnchorElement).style.color = '#94a3b8';
            }}
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64 overflow-y-auto" style={{ backgroundColor: '#0A1628' }}>
        <main className="p-8 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
