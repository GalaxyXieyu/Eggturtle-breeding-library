'use client';

import type { ReactNode } from 'react';
import { UiPreferenceControls } from '@/components/ui-preferences';

export default function PublicShareLayout({
  children,
  modal
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      <div className="public-floating-pref fixed right-3 top-[calc(env(safe-area-inset-top)+10px)] z-50">
        <UiPreferenceControls />
      </div>
      {children}
      {modal}
    </>
  );
}
