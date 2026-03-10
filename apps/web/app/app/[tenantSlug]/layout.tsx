'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  meProfileResponseSchema,
  meSubscriptionResponseSchema,
  mySecurityProfileResponseSchema,
  type MeProfile,
  type MySecurityProfile,
} from '@eggturtle/shared';
import { LayoutDashboard, Package, Layers, Share2, LogOut, UserRound } from 'lucide-react';

import { UiPreferenceControls, useUiPreferences } from '@/components/ui-preferences';
import { Button } from '@/components/ui/button';
import TenantFloatingShareButton from '@/components/tenant-floating-share-button';
import type { TenantShareIntent } from '@/lib/tenant-share';
import { apiRequest, clearAccessToken } from '@/lib/api-client';
import { ensureTenantRouteSession } from '@/lib/tenant-route-session';
import { formatTenantDisplayName } from '@/lib/tenant-display';
import { cn } from '@/lib/utils';

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

const ENABLE_SHARE_NAV_ENTRY = false;
const ENABLE_FLOATING_SHARE_BUTTON = true;
// 侧边栏继续隐藏系列入口；移动端底部导航单独保留系列入口。
const ENABLE_SERIES_ENTRY = false;
const SHELL_COPY = {
  zh: {
    workspace: '用户工作台',
    controlCenter: '控制中心',
    upgradePlan: '升级套餐',
    createShare: '打开统一分享弹窗',
    openSharePage: '打开分享弹窗',
    logout: '退出登录',
    defaultTenant: '选育溯源档案',
    quickSharePending: '正在准备分享弹窗...',
    quickShareSuccess: '分享弹窗已打开',
    quickShareMissingTenant: '当前用户上下文未就绪，暂时无法生成链接。',
    quickShareErrorFallback: '创建分享链接失败。',
    planLoading: '加载套餐中...',
  },
  en: {
    workspace: 'Tenant Workspace',
    controlCenter: 'Control Center',
    upgradePlan: 'Upgrade Plan',
    createShare: 'Open unified share dialog',
    openSharePage: 'Open share dialog',
    logout: 'Sign out',
    defaultTenant: 'Eggturtle Workspace',
    quickSharePending: 'Preparing share dialog...',
    quickShareSuccess: 'Share dialog opened',
    quickShareMissingTenant: 'Tenant context is not ready yet.',
    quickShareErrorFallback: 'Failed to create share link.',
    planLoading: 'Loading plan...',
  },
} as const;

export default function TenantRouteLayout({ children }: TenantRouteLayoutProps) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug ?? '';
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('FREE');
  const [planLoading, setPlanLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupCheckReady, setSetupCheckReady] = useState(false);
  const { locale } = useUiPreferences();
  const copy = SHELL_COPY[locale];
  const displayTenantName = useMemo(
    () => formatTenantDisplayName(tenantSlug, copy.defaultTenant),
    [tenantSlug, copy.defaultTenant],
  );

  const shouldRenderLayoutFloatingShare =
    ENABLE_FLOATING_SHARE_BUTTON &&
    pathname !== `/app/${tenantSlug}` &&
    pathname !== `/app/${tenantSlug}/products` &&
    !pathname?.endsWith('/account') &&
    !pathname?.endsWith('/certificates') &&
    !/^\/app\/[^/]+\/(?:products|breeders)\/[^/]+$/.test(pathname);
  const setupQueryEnabled = searchParams.get('setup') === '1';
  const accountPath = `/app/${tenantSlug}/account`;
  const sharePresentationPath = `/app/${tenantSlug}/share-presentation`;
  const seriesPath = `/app/${tenantSlug}/series`;
  const navItemsWithoutShare = NAV_ITEMS.filter((item) => {
    const itemHref = item.href(tenantSlug);
    if (!ENABLE_SHARE_NAV_ENTRY && itemHref === sharePresentationPath) {
      return false;
    }
    if (!ENABLE_SERIES_ENTRY && itemHref === seriesPath) {
      return false;
    }
    return true;
  });
  const visibleNavItems = setupRequired
    ? navItemsWithoutShare.filter((item) => item.href(tenantSlug) === accountPath)
    : navItemsWithoutShare;
  const mobileNavItems = setupRequired
    ? NAV_ITEMS.filter((item) => item.href(tenantSlug) === accountPath)
    : navItemsWithoutShare;
  const shouldBlockOtherPages = setupCheckReady && setupRequired && pathname !== accountPath;

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
          router,
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
  }, [router, tenantSlug]);

  useEffect(() => {
    let cancelled = false;
    setSetupCheckReady(false);

    void (async () => {
      try {
        const access = await ensureTenantRouteSession({
          tenantSlug,
          missingTenantMessage: '缺少 tenantSlug。',
          router,
          redirectWhenUnauthenticated: false,
        });
        if (!access.ok || cancelled) {
          return;
        }

        const [profileResponse, securityResponse] = await Promise.all([
          apiRequest('/me/profile', {
            responseSchema: meProfileResponseSchema,
          }),
          apiRequest('/me/security-profile', {
            responseSchema: mySecurityProfileResponseSchema,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setSetupRequired(
          shouldRequireProfileSetup(profileResponse.profile, securityResponse.profile),
        );
        setSetupCheckReady(true);
      } catch {
        if (!cancelled) {
          setSetupRequired(true);
          setSetupCheckReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, tenantSlug]);

  useEffect(() => {
    if (!setupCheckReady || !setupRequired) {
      return;
    }

    if (pathname === accountPath && setupQueryEnabled) {
      return;
    }

    router.replace(`${accountPath}?setup=1`);
  }, [
    accountPath,
    pathname,
    router,
    setupCheckReady,
    setupQueryEnabled,
    setupRequired,
    tenantSlug,
  ]);

  function handleLogout() {
    clearAccessToken();
    router.replace('/login');
  }

  return (
    <div className="tenant-shell-bg h-[100svh] overflow-hidden">
      <div className="flex h-full w-full gap-2 p-2 sm:gap-3 sm:p-3 lg:gap-4 lg:p-4">
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
            {visibleNavItems.map((item) => {
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
              variant="ghost"
              className="mt-2 w-full justify-start text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              onClick={handleLogout}
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
            <div className="tenant-mobile-content-safe pb-3 sm:pb-4 lg:pb-4">
              {shouldBlockOtherPages ? (
                <div className="rounded-2xl border border-[#FFD400]/70 bg-[#FFF7D5] px-4 py-3 text-sm font-semibold text-neutral-900">
                  正在跳转到信息补全页，请先完成用户名、密码和密保设置。
                </div>
              ) : (
                children
              )}
            </div>
          </div>
        </section>
      </div>

      <nav
        className="tenant-mobile-nav fixed inset-x-0 bottom-0 z-40 lg:hidden"
        aria-label="用户移动端主导航"
      >
        <div className="tenant-mobile-nav-shell" aria-hidden />
        <ul className="tenant-mobile-nav-list list-none">
          {mobileNavItems.map((item) => {
            const href = item.href(tenantSlug);
            const active = isActive(pathname, href);
            const Icon = item.icon;

            return (
              <li key={`mobile-${href}`} className="tenant-mobile-nav-item list-none">
                <Link
                  href={href}
                  aria-label={item.label[locale]}
                  className={cn(
                    'tenant-mobile-nav-link',
                    active
                      ? 'is-active'
                      : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
                  )}
                >
                  <span className="tenant-mobile-nav-stack">
                    <span className="tenant-mobile-nav-icon">
                      <Icon className="tenant-mobile-nav-icon-glyph" />
                    </span>
                    <span className="tenant-mobile-nav-label">{item.label[locale]}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {shouldRenderLayoutFloatingShare && !setupRequired ? (
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
      pathname.startsWith(`${tenantBase}/subscription/`) ||
      pathname === `${tenantBase}/certificates` ||
      pathname.startsWith(`${tenantBase}/certificates/`)
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

function shouldRequireProfileSetup(profile: MeProfile, securityProfile: MySecurityProfile | null) {
  const hasName = Boolean(profile.name?.trim());
  const hasPassword = Boolean(profile.passwordUpdatedAt);
  const hasSecurityProfile = Boolean(securityProfile?.question?.trim());
  return !(hasName && hasPassword && hasSecurityProfile);
}

function safelyDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
