'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { meResponseSchema } from '@eggturtle/shared';

import { ApiError, apiRequest, clearAccessToken, getAccessToken } from '../../lib/api-client';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/tenants', label: 'Tenants' },
  { href: '/dashboard/memberships', label: 'Memberships' },
  { href: '/dashboard/audit-logs', label: 'Audit Logs' }
];

const webSuperAdminEnabled = process.env.NEXT_PUBLIC_SUPER_ADMIN_ENABLED === 'true';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await apiRequest('/me', {
          responseSchema: meResponseSchema
        });

        if (!cancelled) {
          setCurrentUserEmail(response.user.email);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatError(requestError));
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const warningClassName = useMemo(
    () => `env-warning${webSuperAdminEnabled ? ' ok' : ''}`,
    []
  );

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Eggturtle Backoffice</h1>
          <p>Global super-admin dashboard</p>
        </div>

        <nav className="nav" aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} className={`nav-link${isActive ? ' active' : ''}`} href={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p className={warningClassName}>
            API access still requires <code>SUPER_ADMIN_ENABLED=true</code> and your email in
            <code> SUPER_ADMIN_EMAILS</code>. UI hint flag:{' '}
            <strong>{webSuperAdminEnabled ? 'enabled' : 'disabled'}</strong>
          </p>
          <p className="user-email">Signed in as: {currentUserEmail ?? 'loading...'}</p>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              clearAccessToken();
              router.replace('/login');
            }}
          >
            Sign out
          </button>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}
