'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { getAccessToken } from '@/lib/api-client';
import { capturePendingPublicAttribution } from '@/lib/public-attribution-client';

export default function PublicAttributionCapture() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if (!pathname || getAccessToken()) {
      return;
    }

    capturePendingPublicAttribution();
  }, [pathname, search]);

  return null;
}
