'use client';

import Link from 'next/link';
import { Layers, PawPrint, UserRound } from 'lucide-react';

import { cn } from '../../../lib/utils';
import { appendPublicShareQuery } from './public-share-api';

export type PublicDockTab = 'series' | 'pets' | 'me';

type PublicBottomDockProps = {
  shareToken: string;
  shareQuery?: string;
  activeTab: PublicDockTab;
  className?: string;
};

export default function PublicBottomDock({ shareToken, shareQuery, activeTab, className }: PublicBottomDockProps) {
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
      label: '系列',
      href: appendPublicShareQuery(`${basePath}/series`, shareQuery),
      icon: Layers
    },
    {
      key: 'pets',
      label: '宠物',
      href: appendPublicShareQuery(basePath, shareQuery),
      icon: PawPrint,
      isCenter: true
    },
    {
      key: 'me',
      label: '我的',
      href: appendPublicShareQuery(`${basePath}/me`, shareQuery),
      icon: UserRound
    }
  ];

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/94 px-3 pb-[max(4px,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/90',
        className
      )}
      aria-label="公开分享导航"
    >
      <ul className="mx-auto flex w-full max-w-xl items-center justify-between">
        {tabs.map((item) => {
          const active = activeTab === item.key;
          const Icon = item.icon;

          return (
            <li key={item.key} className="flex flex-1 justify-center">
              <Link
                href={item.href}
                className={cn(
                  'group inline-flex min-w-[64px] flex-col items-center gap-0.5 px-1.5 pb-0 text-[10px] font-medium transition-colors',
                  active ? 'text-neutral-950 dark:text-neutral-50' : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-xl border border-transparent transition-all',
                    item.isCenter
                      ? active
                        ? 'h-10 w-10 -translate-y-1 rounded-full border-[#FFD400]/60 bg-[#FFD400] text-neutral-950 shadow-[0_5px_12px_rgba(255,212,0,0.36)]'
                        : 'h-10 w-10 -translate-y-1 rounded-full border-neutral-200 bg-white text-neutral-700 shadow-[0_4px_9px_rgba(0,0,0,0.1)] dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100'
                      : active
                        ? 'border-neutral-200 bg-neutral-100 text-neutral-900 dark:border-white/20 dark:bg-neutral-800 dark:text-neutral-100'
                        : 'text-current'
                  )}
                >
                  <Icon size={16} />
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
