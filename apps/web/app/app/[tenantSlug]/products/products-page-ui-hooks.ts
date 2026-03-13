import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';

const MOBILE_FILTER_FAB_SHOW_SCROLL_TOP = 180;
const MOBILE_FILTER_FAB_HIDE_SCROLL_TOP = 96;
const MOBILE_FILTER_FAB_SHOW_TOP_FILTER_BOTTOM = -24;
const MOBILE_FILTER_FAB_HIDE_TOP_FILTER_BOTTOM = 24;

const MOBILE_FILTER_FAB_TOP_FILTER_FALLBACK_HEIGHT = 220;

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

function resolveNextMobileFilterFabVisibility(
  current: boolean,
  topFilter: HTMLDivElement | null,
  scrollY: number,
) {
  if (topFilter) {
    const rect = topFilter.getBoundingClientRect();
    const bottom =
      rect.height > 0 ? rect.bottom : rect.top + MOBILE_FILTER_FAB_TOP_FILTER_FALLBACK_HEIGHT;

    if (bottom <= MOBILE_FILTER_FAB_SHOW_TOP_FILTER_BOTTOM) {
      return true;
    }

    if (bottom >= MOBILE_FILTER_FAB_HIDE_TOP_FILTER_BOTTOM) {
      return false;
    }

    return current;
  }

  if (scrollY >= MOBILE_FILTER_FAB_SHOW_SCROLL_TOP) {
    return true;
  }

  if (scrollY <= MOBILE_FILTER_FAB_HIDE_SCROLL_TOP) {
    return false;
  }

  return current;
}

type UseProductsPageUiEffectsInput = {
  isFilterPopoverOpen: boolean;
  onRequestFilterPopoverClose: () => void;
  mobileTopFilterRef: RefObject<HTMLDivElement>;
  setShowMobileFilterFab: Dispatch<SetStateAction<boolean>>;
  setIsMobileFilterLayout: Dispatch<SetStateAction<boolean>>;
};

export function useProductsPageUiEffects({
  isFilterPopoverOpen,
  onRequestFilterPopoverClose,
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
      onRequestFilterPopoverClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onRequestFilterPopoverClose();
      }
    };

    const handleScroll = () => {
      onRequestFilterPopoverClose();
    };

    // Use bubble phase so inner buttons can handle onClick first.
    // Using capture here will close the overlay before React's onClick runs,
    // making filter pills appear unclickable on both desktop and mobile.
    // Delay registration to avoid closing the popover immediately after opening.
    const clickOptions: AddEventListenerOptions = { capture: false };

    const timerId = window.setTimeout(() => {
      document.addEventListener('click', handleClickAway, clickOptions);
    }, 0);

    document.addEventListener('keydown', handleKeyDown);
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener('click', handleClickAway, clickOptions);
      document.removeEventListener('keydown', handleKeyDown);
      scrollTarget.removeEventListener('scroll', handleScroll);
    };
  }, [isFilterPopoverOpen, onRequestFilterPopoverClose]);

  useEffect(() => {
    let rafId: number | null = null;
    const syncTimerIds: number[] = [];
    const scrollTarget = resolveTenantScrollRoot() ?? window;

    const update = () => {
      rafId = null;

      const topFilter = mobileTopFilterRef.current;
      const scrollY = readScrollTop(scrollTarget);

      // Use hysteresis so list-height changes near the threshold do not flip
      // between the top filter bar and the floating action button.
      setShowMobileFilterFab((current) =>
        resolveNextMobileFilterFabVisibility(current, topFilter, scrollY),
      );
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
