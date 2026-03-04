'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { meSubscriptionResponseSchema } from '@eggturtle/shared';
import { LayoutDashboard, Package, Layers, Share2, LogOut, UserRound } from 'lucide-react';

import { UiPreferenceControls, useUiPreferences } from '../../../components/ui-preferences';
import { Button } from '../../../components/ui/button';
import TenantFloatingShareButton, {
  type TenantShareIntent,
} from '../../../components/tenant-floating-share-button';
import { apiRequest, clearAccessToken } from '../../../lib/api-client';
import { formatApiError } from '../../../lib/error-utils';
import { ensureTenantRouteSession } from '../../../lib/tenant-route-session';
import { createTenantFeedShareLink } from '../../../lib/tenant-share';
import { formatTenantDisplayName } from '../../../lib/tenant-display';
import { cn } from '../../../lib/utils';

type TenantRouteLayoutProps = {
  children: ReactNode;
};

type NavItem = {
  label: {
    zh: string;
    en: string;
  };
  href: (tenantSlug: string) => string;
  icon: typeof LayoutDashboard;
};

type PlanTier = 'FREE' | 'BASIC' | 'PRO';

const NAV_ITEMS: NavItem[] = [
  {
    label: { zh: '数据', en: 'Dashboard' },
    href: (tenantSlug) => `/app/${tenantSlug}`,
    icon: LayoutDashboard,
  },
  {
    label: { zh: '系列', en: 'Series' },
    href: (tenantSlug) => `/app/${tenantSlug}/series`,
    icon: Layers,
  },
  {
    label: { zh: '宠物', en: 'Pets' },
    href: (tenantSlug) => `/app/${tenantSlug}/products`,
    icon: Package,
  },
  {
    label: { zh: '我的', en: 'Account' },
    href: (tenantSlug) => `/app/${tenantSlug}/account`,
    icon: UserRound,
  },
  {
    label: { zh: '分享', en: 'Share' },
    href: (tenantSlug) => `/app/${tenantSlug}/share-presentation`,
    icon: Share2,
  },
];

const SHELL_COPY = {
  zh: {
    workspace: '租户工作台',
    controlCenter: '控制中心',
    upgradePlan: '升级套餐',
    createShare: '创建并复制分享链接',
    openSharePage: '打开分享页',
    logout: '退出登录',
    defaultTenant: '蛋龟选育库',
    quickSharePending: '正在打开分享页...',
    quickShareSuccess: '已打开分享页',
    quickShareMissingTenant: '当前租户上下文未就绪，暂时无法生成链接。',
    quickShareErrorFallback: '创建分享链接失败。',
    planLoading: '加载套餐中...',
  },
  en: {
    workspace: 'Tenant Workspace',
    controlCenter: 'Control Center',
    upgradePlan: 'Upgrade Plan',
    createShare: 'Create & Copy Share Link',
    openSharePage: 'Open share page',
    logout: 'Sign out',
    defaultTenant: 'Eggturtle Workspace',
    quickSharePending: 'Opening share page...',
    quickShareSuccess: 'Share page opened',
    quickShareMissingTenant: 'Tenant context is not ready yet.',
    quickShareErrorFallback: 'Failed to create share link.',
    planLoading: 'Loading plan...',
  },
} as const;

export default function TenantRouteLayout({ children }: TenantRouteLayoutProps) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug ?? '';
  const pathname = usePathname();
  const router = useRouter();
  const [quickSharePending, setQuickSharePending] = useState(false);
  const [quickShareNotice, setQuickShareNotice] = useState<string | null>(null);
  const [quickShareError, setQuickShareError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('FREE');
  const [planLoading, setPlanLoading] = useState(true);
  const { locale } = useUiPreferences();
  const copy = SHELL_COPY[locale];
  const displayTenantName = useMemo(
    () => formatTenantDisplayName(tenantSlug, copy.defaultTenant),
    [tenantSlug, copy.defaultTenant],
  );

  const shouldRenderLayoutFloatingShare =
    pathname !== `/app/${tenantSlug}` &&
    !pathname?.endsWith('/products') &&
    !pathname?.endsWith('/series');

  const floatingShareIntent = useMemo<TenantShareIntent>(() => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] !== 'app' || segments[1] !== tenantSlug) {
      return 'feed';
    }

    if (segments[2] === 'series') {
      return 'series';
    }

    if ((segments[2] === 'products' || segments[2] === 'breeders') && segments[3]) {
      return { productId: safelyDecodePathSegment(segments[3]) };
    }

    return 'feed';
  }, [pathname, tenantSlug]);

  useEffect(() => {
    let cancelled = false;
    setPlanLoading(true);

    void (async () => {
      try {
        const access = await ensureTenantRouteSession({
          tenantSlug,
          missingTenantMessage: '缺少 tenantSlug。',
          redirectWhenUnauthenticated: false,
        });
        if (!access.ok) {
          setPlanLoading(false);
          return;
        }

        const response = await apiRequest('/me/subscription', {
          responseSchema: meSubscriptionResponseSchema,
        });

        if (cancelled) {
          return;
        }

        setCurrentPlan(normalizePlanTier(response.subscription.plan));
      } catch {
        if (!cancelled) {
          setCurrentPlan('FREE');
        }
      } finally {
        if (!cancelled) {
          setPlanLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  async function handleQuickShareOpen() {
    if (quickSharePending) {
      return;
    }

    setQuickSharePending(true);
    setQuickShareNotice(null);
    setQuickShareError(null);

    try {
      const share = await createTenantFeedShareLink({
        missingTenantMessage: copy.quickShareMissingTenant,
      });
      const permanentLink = share.permanentUrl;
      const popupWindow = window.open(permanentLink, '_blank', 'noopener');
      if (!popupWindow) {
        window.location.href = permanentLink;
      }
      setQuickShareNotice(copy.quickShareSuccess);
    } catch (error) {
      setQuickShareError(formatApiError(error, copy.quickShareErrorFallback));
    } finally {
      setQuickSharePending(false);
    }
  }

  return (
    <div className="tenant-shell-bg h-[100svh] overflow-hidden">
      <div className="flex h-full w-full gap-2 p-2 pb-[calc(env(safe-area-inset-bottom)+72px)] sm:gap-3 sm:p-3 lg:gap-4 lg:p-4 lg:pb-4">
        <aside className="hidden w-[272px] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_8px_26px_rgba(0,0,0,0.08)] dark:border-neutral-800 dark:bg-neutral-950/96 dark:shadow-[0_20px_40px_rgba(0,0,0,0.45)] lg:flex">
          <div className="border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">
              {copy.workspace}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-3xl font-semibold leading-none text-neutral-900 dark:text-neutral-100">
                {displayTenantName}
              </p>
              <span className="inline-flex items-center rounded-full border border-[#FFD400]/45 bg-[#FFD400]/20 px-2 py-0.5 text-[11px] font-semibold text-neutral-900 dark:border-[#FFD400]/35 dark:bg-[#FFD400]/16 dark:text-[#ffe8a6]">
                {planLoading ? copy.planLoading : formatPlanBadgeLabel(currentPlan, locale)}
              </span>
            </div>
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const href = item.href(tenantSlug);
              const active = isActive(pathname, href);
              const Icon = item.icon;

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-neutral-600 transition-colors dark:text-neutral-300',
                    active
                      ? 'bg-neutral-900 text-white ring-1 ring-[#FFD400]/45 dark:bg-[#FFD400]/18 dark:text-[#ffe28a] dark:ring-[#FFD400]/30'
                      : 'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                      active
                        ? 'bg-[#FFD400] text-black dark:bg-[#FFD400]/85 dark:text-neutral-900'
                        : 'bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:group-hover:bg-neutral-800',
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <span>{item.label[locale]}</span>
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-neutral-200 px-3 pb-2 pt-3 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-xl border-neutral-200 !bg-neutral-50 !text-neutral-800 shadow-none hover:!bg-neutral-100 hover:!text-neutral-900 [&_svg]:text-neutral-500 hover:[&_svg]:text-neutral-700 dark:border-neutral-700 dark:!bg-neutral-900 dark:!text-neutral-100 dark:hover:!bg-neutral-800 dark:[&_svg]:text-neutral-300 dark:hover:[&_svg]:text-neutral-100"
              onClick={() => void handleQuickShareOpen()}
              disabled={quickSharePending}
            >
              <Share2 size={16} />
              <span>{quickSharePending ? copy.quickSharePending : copy.createShare}</span>
            </Button>

            {quickShareError ? (
              <p className="mt-2 break-all rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {quickShareError}
              </p>
            ) : null}
            {quickShareNotice ? (
              <p className="mt-2 break-all rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {quickShareNotice}
              </p>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full justify-start text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              onClick={() => {
                clearAccessToken();
                router.replace('/login');
              }}
            >
              <LogOut size={16} />
              <span>{copy.logout}</span>
            </Button>

            <div className="mt-2 hidden sm:block">
              <UiPreferenceControls className="tenant-sidebar-pref" />
            </div>
          </div>
        </aside>

        <section className="flex h-full min-w-0 flex-1 flex-col">
          <div data-tenant-scroll-root="true" className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="tenant-mobile-content-safe pb-3 sm:pb-4 lg:pb-4">{children}</div>
          </div>
        </section>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 h-[calc(var(--tenant-mobile-nav-height)+var(--tenant-mobile-nav-safe-bottom))] px-2 pt-0 pb-[var(--tenant-mobile-nav-safe-bottom)] text-[13px] lg:hidden"
        aria-label="租户移动端主导航"
      >
        {/* 半透明背景仅保留在下半区，顶部完全透明（含中间按钮两侧） */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 top-6 border-t border-black/10 bg-white/96 backdrop-blur dark:border-white/10 dark:bg-neutral-950/92"
          aria-hidden
        />
        <ul className="relative z-0 mx-auto flex w-full max-w-xl items-end justify-between px-1 leading-[15.85px] mt-[5px] mb-[5px]">
          {NAV_ITEMS.map((item, index) => {
            const href = item.href(tenantSlug);
            const active = isActive(pathname, href);
            const Icon = item.icon;
            const isCenter = index === 2;

            if (isCenter) {
              return (
                <li key={`mobile-${href}`} className="flex min-w-[72px] justify-center">
                  <Link
                    href={href}
                    className="flex flex-col items-center gap-1 transition-opacity active:opacity-90 -translate-y-2"
                    aria-label={item.label[locale]}
                  >
                    <span
                      className={cn(
                        'flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.15)] transition dark:shadow-[0_4px_18px_rgba(0,0,0,0.4)]',
                        active
                          ? 'bg-[#FFD400] text-neutral-900 ring-2 ring-[#FFD400] ring-offset-2 ring-offset-white dark:ring-offset-neutral-950'
                          : 'bg-[#FFD400] text-neutral-900',
                      )}
                    >
                      <Icon size={26} />
                    </span>
                    <span
                      className={cn(
                        'text-[11px] font-medium whitespace-nowrap',
                        active
                          ? 'text-neutral-900 dark:text-neutral-100'
                          : 'text-neutral-600 dark:text-neutral-400',
                      )}
                    >
                      {item.label[locale]}
                    </span>
                  </Link>
                </li>
              );
            }

            return (
              <li key={`mobile-${href}`} className="flex min-w-[56px] justify-center">
                <Link
                  href={href}
                  className={cn(
                    'inline-flex min-w-[56px] flex-col items-center gap-0.5 px-1 pb-0.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'text-neutral-900 dark:text-neutral-100'
                      : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-9 w-9 items-center justify-center rounded-2xl transition-colors',
                      active
                        ? 'bg-neutral-900 text-white dark:bg-[#FFD400]/20 dark:text-[#FFD400]'
                        : 'bg-transparent text-current',
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <span>{item.label[locale]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {shouldRenderLayoutFloatingShare ? (
        <TenantFloatingShareButton intent={floatingShareIntent} className="lg:hidden" />
      ) : null}
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (/\/app\/[^/]+\/account$/.test(href)) {
    const tenantBase = href.replace(/\/account$/, '');
    if (
      pathname === `${tenantBase}/subscription` ||
      pathname.startsWith(`${tenantBase}/subscription/`)
    ) {
      return true;
    }
  }

  if (/\/app\/[^/]+$/.test(href)) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function normalizePlanTier(plan: string): PlanTier {
  if (plan === 'BASIC') {
    return 'BASIC';
  }
  if (plan === 'PRO') {
    return 'PRO';
  }
  return 'FREE';
}

function formatPlanBadgeLabel(plan: PlanTier, locale: 'zh' | 'en') {
  if (locale === 'zh') {
    if (plan === 'FREE') {
      return '免费版';
    }
    if (plan === 'BASIC') {
      return '基础版';
    }
    return '专业版';
  }

  if (plan === 'FREE') {
    return 'Free';
  }
  if (plan === 'BASIC') {
    return 'Basic';
  }
  return 'Pro';
}

function safelyDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
