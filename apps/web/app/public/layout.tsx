import type { ReactNode } from 'react';
import { Suspense } from 'react';

import PublicAttributionCapture from '@/app/public/_shared/public-attribution-capture';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PublicAttributionCapture />
      </Suspense>
      {children}
    </>
  );
}
