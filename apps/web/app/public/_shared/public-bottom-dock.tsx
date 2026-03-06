'use client';

import Link from 'next/link';
import { Layers, PawPrint, UserRound } from 'lucide-react';

import { cn } from '@/lib/utils';
import { appendPublicShareQuery } from '@/app/public/_shared/public-share-api';

export type PublicDockTab = 'series' | 'pets' | 'me';

type PublicBottomDockProps = {
  shareToken: string;
  shareQuery?: string;
  activeTab: PublicDockTab;
  className?: string;
};

export default function PublicBottomDock({
  shareToken,
  shareQuery,
  activeTab,
  className,
}: PublicBottomDockProps) {
  const basePath = `/public/s/${shareToken}`;

  const tabs: Array<{
    key: PublicDockTab;
    label: string;
    href: string;
    icon: typeof Layers;
    isCenter?: boolean;
  }> = [
    {
      key: 'series',
      label: '数据',
      href: appendPublicShareQuery(`${basePath}/series`, shareQuery),
      icon: Layers,
    },
    {
      key: 'pets',
      label: '宠物',
      href: appendPublicShareQuery(basePath, shareQuery),
      icon: PawPrint,
      isCenter: true,
    },
    {
      key: 'me',
      label: '我的',
      href: appendPublicShareQuery(`${basePath}/me`, shareQuery),
      icon: UserRound,
    },
  ];

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 h-[calc(56px+max(24px,env(safe-area-inset-bottom)))] px-2 pt-0 pb-[max(24px,env(safe-area-inset-bottom))] text-[13px]',
        className,
      )}
      aria-label="公开分享导航"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 top-6 border-t border-black/10 bg-white shadow-[0_-6px_16px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-neutral-950"
        aria-hidden
      />
      <ul className="relative z-0 mx-auto flex w-full max-w-[330px] items-end justify-between px-0 leading-[15.85px] sm:max-w-xl sm:px-1">
        {tabs.map((item) => {
          const active = activeTab === item.key;
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <li key={item.key} className="flex min-w-[68px] justify-center">
                <Link
                  href={item.href}
                  className="flex flex-col items-center gap-1 transition-opacity active:opacity-90 -translate-y-2"
                  aria-label={item.label}
                >
                  <span
                    className={cn(
                      'flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.15)] transition dark:shadow-[0_4px_18px_rgba(0,0,0,0.4)]',
                      active
                        ? 'bg-[#FFD400] text-neutral-900 ring-2 ring-[#FFD400] ring-offset-2 ring-offset-white dark:ring-offset-neutral-950'
                        : 'bg-[#FFD400] text-neutral-900',
                    )}
                  >
                    <Icon size={26} />
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium whitespace-nowrap',
                      active
                        ? 'text-neutral-900 dark:text-neutral-100'
                        : 'text-neutral-600 dark:text-neutral-400',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.key} className="flex min-w-[50px] justify-center">
              <Link
                href={item.href}
                className={cn(
                  'inline-flex min-w-[50px] flex-col items-center gap-0.5 px-0.5 pb-0.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-2xl transition-colors',
                    active
                      ? 'bg-neutral-900 text-white dark:bg-[#FFD400]/20 dark:text-[#FFD400]'
                      : 'bg-transparent text-current',
                  )}
                >
                  <Icon size={18} />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
