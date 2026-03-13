'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { UiPreferenceControls } from '@/components/ui-preferences';

export default function PublicShareLayout({
  children,
  modal
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  const pathname = usePathname();
  // 详情页（/public/s/:token/products/:id）不显示语言/主题切换按钮
  const isDetailPage = /\/products\/[^/]+$/.test(pathname);

  return (
    <>
      {!isDetailPage && (
        <div className="public-floating-pref fixed right-3 top-[calc(env(safe-area-inset-top)+10px)] z-50">
          <UiPreferenceControls />
        </div>
      )}
      {children}
      {modal}
    </>
  );
}
