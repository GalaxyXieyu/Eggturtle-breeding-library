'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';

import { modalCloseButtonClass } from '@/components/ui/floating-actions';

export default function PublicShareDetailModal({
  children,
  fallbackPath
}: {
  children: ReactNode;
  fallbackPath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fallbackHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${fallbackPath}?${query}` : fallbackPath;
  }, [fallbackPath, searchParams]);

  const closeModal = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  }, [fallbackHref, router]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      closeModal();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeModal]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 sm:flex sm:items-center sm:justify-center sm:p-4">
      <button
        type="button"
        aria-label="关闭详情弹窗"
        className="absolute inset-0 hidden sm:block"
        onClick={closeModal}
      />
      <div className="relative h-full w-full bg-white sm:h-[min(92vh,960px)] sm:max-w-[1240px] sm:overflow-hidden sm:rounded-3xl sm:border sm:border-white/35 sm:shadow-[0_24px_68px_rgba(0,0,0,0.36)]">
        <button
          type="button"
          aria-label="关闭详情弹窗"
          className={`${modalCloseButtonClass} absolute right-3 top-3 z-[95]`}
          onClick={closeModal}
        >
          <X size={18} />
        </button>
        <div className="h-full overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
