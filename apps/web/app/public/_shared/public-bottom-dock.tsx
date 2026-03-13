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
  clientTabKeys?: PublicDockTab[];
  onTabChange?: (tab: PublicDockTab) => void;
};

export default function PublicBottomDock({
  shareToken,
  shareQuery,
  activeTab,
  className,
  clientTabKeys = [],
  onTabChange,
}: PublicBottomDockProps) {
  const basePath = `/public/s/${shareToken}`;

  const tabs: Array<{
    key: PublicDockTab;
    label: string;
    href: string;
    icon: typeof Layers;
  }> = [
    {
      key: 'series',
      label: '功能',
      href: appendPublicShareQuery(`${basePath}/series`, shareQuery),
      icon: Layers,
    },
    {
      key: 'pets',
      label: '宠物',
      href: appendPublicShareQuery(basePath, shareQuery),
      icon: PawPrint,
    },
    {
      key: 'me',
      label: '我的',
      href: appendPublicShareQuery(`${basePath}?tab=me`, shareQuery),
      icon: UserRound,
    },
  ];

  return (
    <nav
      className={cn('tenant-mobile-nav fixed inset-x-0 bottom-0 z-50 lg:hidden', className)}
      aria-label="公开分享导航"
    >
      <div className="tenant-mobile-nav-shell" aria-hidden />
      <ul className="tenant-mobile-nav-list list-none">
        {tabs.map((item) => {
          const active = activeTab === item.key;
          const Icon = item.icon;
          const linkClassName = cn(
            'tenant-mobile-nav-link',
            active
              ? 'is-active'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
          );
          const content = (
            <span className="tenant-mobile-nav-stack">
              <span className="tenant-mobile-nav-icon">
                <Icon className="tenant-mobile-nav-icon-glyph" />
              </span>
              <span className="tenant-mobile-nav-label">{item.label}</span>
            </span>
          );

          return (
            <li key={item.key} className="tenant-mobile-nav-item list-none">
              {clientTabKeys.includes(item.key) && onTabChange ? (
                <button
                  type="button"
                  aria-label={item.label}
                  className={linkClassName}
                  onClick={() => onTabChange(item.key)}
                >
                  {content}
                </button>
              ) : (
                <Link href={item.href} aria-label={item.label} className={linkClassName}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
