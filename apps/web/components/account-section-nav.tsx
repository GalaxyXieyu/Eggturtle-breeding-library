'use client';

import Link from 'next/link';

import { useUiPreferences } from '@/components/ui-preferences';
import { ACCOUNT_NAV_MESSAGES } from '@/lib/locales/account';
import { cn } from '@/lib/utils';

type AccountSectionNavActive = 'profile' | 'subscription' | 'referral' | 'certificates';

type AccountSectionNavProps = {
  active: AccountSectionNavActive;
  tenantSlug: string;
};

export function AccountSectionNav({ active, tenantSlug }: AccountSectionNavProps) {
  const { locale } = useUiPreferences();
  const messages = ACCOUNT_NAV_MESSAGES[locale];

  const navItems: Array<{
    key: AccountSectionNavActive;
    label: string;
    href: (nextTenantSlug: string) => string;
  }> = [
    {
      key: 'profile',
      label: messages.profile,
      href: (nextTenantSlug) => `/app/${nextTenantSlug}/account`,
    },
    {
      key: 'subscription',
      label: messages.subscription,
      href: (nextTenantSlug) => `/app/${nextTenantSlug}/account?tab=subscription`,
    },
    {
      key: 'referral',
      label: messages.referral,
      href: (nextTenantSlug) => `/app/${nextTenantSlug}/account?tab=referral`,
    },
    {
      key: 'certificates',
      label: messages.certificates,
      href: (nextTenantSlug) => `/app/${nextTenantSlug}/certificates`,
    },
  ];

  return (
    <section className="flex flex-wrap gap-2">
      {navItems.map((item) => {
        const selected = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href(tenantSlug)}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'inline-flex min-w-[68px] items-center justify-center rounded-full border px-4 py-1.5 text-sm font-semibold leading-5 transition-colors',
              selected
                ? 'border-neutral-900 bg-neutral-900 text-white visited:text-white hover:bg-neutral-900 hover:text-white'
                : 'border-neutral-200 bg-white text-neutral-700 visited:text-neutral-700 hover:border-neutral-300 hover:text-neutral-900',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </section>
  );
}
