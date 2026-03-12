'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useUiPreferences } from '@/components/ui-preferences';
import { DASHBOARD_SETTINGS_TAB_MESSAGES } from '@/lib/locales/shell';

const TAB_ITEMS = [
  {
    href: '/dashboard/settings/platform-branding',
    label: { zh: '平台品牌', en: 'Platform Branding' },
  },
  {
    href: '/dashboard/settings/tenant-branding',
    label: { zh: '租户品牌', en: 'Tenant Branding' },
  },
  {
    href: '/dashboard/settings/audit-logs',
    label: { zh: '审计记录', en: 'Audit Logs' },
  },
] as const;

export function DashboardSettingsTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useUiPreferences();
  const messages = DASHBOARD_SETTINGS_TAB_MESSAGES[locale];
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    if (!confirm(messages.signOutConfirm)) {
      return;
    }

    setSigningOut(true);
    try {
      await fetch('/api/auth/session', {
        method: 'DELETE',
        headers: {
          'x-eggturtle-auth-surface': 'admin'
        },
        cache: 'no-store'
      });
    } finally {
      router.replace('/login');
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <nav className="dashboard-settings-tabs" aria-label={messages.settingsNav}>
      <div className="dashboard-settings-tabs-list" role="tablist">
        {TAB_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              role="tab"
              aria-selected={active}
              className={`dashboard-settings-tab${active ? ' active' : ''}`}
            >
              {item.label[locale]}
            </Link>
          );
        })}
        <button
          type="button"
          className="dashboard-settings-tab secondary"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? messages.signingOut : messages.signOut}
        </button>
      </div>
    </nav>
  );
}
