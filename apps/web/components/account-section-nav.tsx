'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';

type AccountSectionNavActive = 'profile' | 'subscription' | 'certificates';

type AccountSectionNavProps = {
  active: AccountSectionNavActive;
  tenantSlug: string;
};

const NAV_ITEMS: Array<{ key: AccountSectionNavActive; label: string; href: (tenantSlug: string) => string }> = [
  {
    key: 'profile',
    label: '账号',
    href: (tenantSlug) => `/app/${tenantSlug}/account`,
  },
  {
    key: 'subscription',
    label: '订阅',
    href: (tenantSlug) => `/app/${tenantSlug}/account?tab=subscription`,
  },
  {
    key: 'certificates',
    label: '证书',
    href: (tenantSlug) => `/app/${tenantSlug}/certificates`,
  },
];

export function AccountSectionNav({ active, tenantSlug }: AccountSectionNavProps) {
  return (
    <section className="flex flex-wrap gap-2">
      {NAV_ITEMS.map((item) => {
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
