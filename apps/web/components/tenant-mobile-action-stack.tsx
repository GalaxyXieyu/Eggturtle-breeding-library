'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

import { useUiPreferences } from '@/components/ui-preferences';
import { FloatingActionButton, FloatingActionDock } from '@/components/ui/floating-actions';

const DEFAULT_SCROLL_ROOT_SELECTOR = '[data-tenant-scroll-root="true"]';
const DEFAULT_SCROLL_THRESHOLD = 480;

const STACK_MESSAGES = {
  zh: {
    scrollToTop: '回到顶部',
  },
  en: {
    scrollToTop: 'Back to top',
  },
} as const;

type TenantMobileActionStackProps = {
  children: ReactNode;
  className?: string;
  enableScrollTop?: boolean;
  scrollRootSelector?: string;
  scrollThreshold?: number;
};

export default function TenantMobileActionStack({
  children,
  className,
  enableScrollTop = true,
  scrollRootSelector = DEFAULT_SCROLL_ROOT_SELECTOR,
  scrollThreshold = DEFAULT_SCROLL_THRESHOLD,
}: TenantMobileActionStackProps) {
  const { locale } = useUiPreferences();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (!enableScrollTop) {
      setShowScrollTop(false);
      return;
    }

    const scrollRoot =
      document.querySelector<HTMLElement>(scrollRootSelector) ?? window;

    let frameId = 0;

    const readScrollTop = () =>
      scrollRoot instanceof Window
        ? window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
        : scrollRoot.scrollTop;

    const updateVisibility = () => {
      setShowScrollTop(readScrollTop() > scrollThreshold);
    };

    const handleScroll = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updateVisibility();
      });
    };

    updateVisibility();
    scrollRoot.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }

      scrollRoot.removeEventListener('scroll', handleScroll);
    };
  }, [enableScrollTop, scrollRootSelector, scrollThreshold]);

  function handleScrollToTop() {
    const scrollRoot =
      document.querySelector<HTMLElement>(scrollRootSelector) ?? window;

    if (scrollRoot instanceof Window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <FloatingActionDock className={className}>
      {children}
      {showScrollTop ? (
        <FloatingActionButton
          aria-label={STACK_MESSAGES[locale].scrollToTop}
          title={STACK_MESSAGES[locale].scrollToTop}
          onClick={handleScrollToTop}
        >
          <ChevronUp size={18} />
        </FloatingActionButton>
      ) : null}
    </FloatingActionDock>
  );
}
