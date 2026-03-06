import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';

function resolveTenantScrollRoot(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return document.querySelector<HTMLElement>('[data-tenant-scroll-root="true"]');
}

function readScrollTop(target: HTMLElement | Window) {
  if (target instanceof Window) {
    return target.scrollY;
  }

  return target.scrollTop;
}

type UseProductsPageUiEffectsInput = {
  isFilterPopoverOpen: boolean;
  setIsFilterPopoverOpen: Dispatch<SetStateAction<boolean>>;
  mobileTopFilterRef: RefObject<HTMLDivElement | null>;
  setShowMobileFilterFab: Dispatch<SetStateAction<boolean>>;
  setIsMobileFilterLayout: Dispatch<SetStateAction<boolean>>;
};

export function useProductsPageUiEffects({
  isFilterPopoverOpen,
  setIsFilterPopoverOpen,
  mobileTopFilterRef,
  setShowMobileFilterFab,
  setIsMobileFilterLayout,
}: UseProductsPageUiEffectsInput) {
  useEffect(() => {
    if (!isFilterPopoverOpen) {
      return;
    }

    const scrollTarget = resolveTenantScrollRoot() ?? window;

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-products-filter-root="true"]')) {
        return;
      }
      setIsFilterPopoverOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFilterPopoverOpen(false);
      }
    };

    const handleScroll = () => {
      setIsFilterPopoverOpen(false);
    };

    const clickOptions: AddEventListenerOptions = { capture: true };

    document.addEventListener('click', handleClickAway, clickOptions);
    document.addEventListener('keydown', handleKeyDown);
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('click', handleClickAway, clickOptions);
      document.removeEventListener('keydown', handleKeyDown);
      scrollTarget.removeEventListener('scroll', handleScroll);
    };
  }, [isFilterPopoverOpen, setIsFilterPopoverOpen]);

  useEffect(() => {
    let rafId: number | null = null;
    const syncTimerIds: number[] = [];
    const scrollTarget = resolveTenantScrollRoot() ?? window;

    const update = () => {
      rafId = null;

      const topFilter = mobileTopFilterRef.current;
      const scrollY = readScrollTop(scrollTarget);

      setShowMobileFilterFab((current) => {
        if (current) {
          return scrollY > 140;
        }

        if (!topFilter) {
          return scrollY > 220;
        }

        const bottom = topFilter.getBoundingClientRect().bottom;
        return bottom < 8;
      });
    };

    const scheduleUpdate = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(update);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleUpdate();
      }
    };

    scheduleUpdate();
    syncTimerIds.push(window.setTimeout(scheduleUpdate, 120));
    syncTimerIds.push(window.setTimeout(scheduleUpdate, 320));

    scrollTarget.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    window.addEventListener('pageshow', scheduleUpdate);
    window.addEventListener('focus', scheduleUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      scrollTarget.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      window.removeEventListener('pageshow', scheduleUpdate);
      window.removeEventListener('focus', scheduleUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      syncTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [mobileTopFilterRef, setShowMobileFilterFab]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(max-width: 1023px)');
    const update = () => {
      setIsMobileFilterLayout(media.matches);
    };

    update();
    media.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, [setIsMobileFilterLayout]);
}
