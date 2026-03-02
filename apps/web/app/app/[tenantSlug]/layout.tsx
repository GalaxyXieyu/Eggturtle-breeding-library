'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  createShareRequestSchema,
  createShareResponseSchema,
  meResponseSchema,
  meSubscriptionResponseSchema
} from '@eggturtle/shared';
import {
  LayoutDashboard,
  Package,
  Layers,
  QrCode,
  Link2,
  Wallet,
  LogOut,
  Menu,
  X,
  UserRound
} from 'lucide-react';

import { UiPreferenceControls, useUiPreferences } from '../../../components/ui-preferences';
import { Button } from '../../../components/ui/button';
import { ApiError, apiRequest, clearAccessToken, getAccessToken } from '../../../lib/api-client';
import { formatTenantDisplayName } from '../../../lib/tenant-display';
import { switchTenantBySlug } from '../../../lib/tenant-session';
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
    label: { zh: '控制台', en: 'Dashboard' },
    href: (tenantSlug) => `/app/${tenantSlug}`,
    icon: LayoutDashboard
  },
  {
    label: { zh: '套餐订阅', en: 'Subscription' },
    href: (tenantSlug) => `/app/${tenantSlug}/subscription`,
    icon: Wallet
  },
  {
    label: { zh: '宠物管理', en: 'Pets' },
    href: (tenantSlug) => `/app/${tenantSlug}/products`,
    icon: Package
  },
  {
    label: { zh: '系列管理', en: 'Series' },
    href: (tenantSlug) => `/app/${tenantSlug}/series`,
    icon: Layers
  },
  {
    label: { zh: '分享展示', en: 'Share Showcase' },
    href: (tenantSlug) => `/app/${tenantSlug}/share-presentation`,
    icon: QrCode
  },
  {
    label: { zh: '个人设置', en: 'Profile' },
    href: (tenantSlug) => `/app/${tenantSlug}/account`,
    icon: UserRound
  }
];

const SHELL_COPY = {
  zh: {
    workspace: '租户工作台',
    controlCenter: '控制中心',
    upgradePlan: '升级套餐',
    createShare: '创建并复制分享链接',
    logout: '退出登录',
    defaultTenant: '蛋龟选育库',
    openMenu: '打开导航菜单',
    closeMenu: '关闭导航菜单',
    closeSidebar: '关闭侧边栏',
    quickSharePending: '正在生成链接...',
    quickShareSuccess: '分享链接已复制',
    quickShareFallback: '复制失败，请手动复制：',
    quickShareMissingTenant: '当前租户上下文未就绪，暂时无法生成链接。',
    quickShareErrorFallback: '创建分享链接失败。',
    planLoading: '加载套餐中...'
  },
  en: {
    workspace: 'Tenant Workspace',
    controlCenter: 'Control Center',
    upgradePlan: 'Upgrade Plan',
    createShare: 'Create & Copy Share Link',
    logout: 'Sign out',
    defaultTenant: 'Eggturtle Workspace',
    openMenu: 'Open navigation menu',
    closeMenu: 'Close navigation menu',
    closeSidebar: 'Close sidebar',
    quickSharePending: 'Creating share link...',
    quickShareSuccess: 'Share link copied',
    quickShareFallback: 'Copy failed, please copy manually:',
    quickShareMissingTenant: 'Tenant context is not ready yet.',
    quickShareErrorFallback: 'Failed to create share link.',
    planLoading: 'Loading plan...'
  }
} as const;

export default function TenantRouteLayout({ children }: TenantRouteLayoutProps) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug ?? '';
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [quickSharePending, setQuickSharePending] = useState(false);
  const [quickShareMessage, setQuickShareMessage] = useState<string | null>(null);
  const [quickShareError, setQuickShareError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('FREE');
  const [planLoading, setPlanLoading] = useState(true);
  const { locale } = useUiPreferences();
  const copy = SHELL_COPY[locale];
  const displayTenantName = useMemo(() => formatTenantDisplayName(tenantSlug, copy.defaultTenant), [tenantSlug, copy.defaultTenant]);

  const activeLabel = useMemo(() => {
    const matched = NAV_ITEMS.find((item) => isActive(pathname, item.href(tenantSlug)));
    return matched?.label[locale] ?? NAV_ITEMS[0].label[locale];
  }, [pathname, tenantSlug, locale]);

  useEffect(() => {
    if (!tenantSlug || !getAccessToken()) {
      setPlanLoading(false);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        const response = await apiRequest('/me/subscription', {
          responseSchema: meSubscriptionResponseSchema
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

  async function handleQuickShareCopy() {
    if (quickSharePending) {
      return;
    }

    setQuickSharePending(true);
    setQuickShareMessage(null);
    setQuickShareError(null);

    try {
      const meResponse = await apiRequest('/me', {
        responseSchema: meResponseSchema
      });

      if (!meResponse.tenantId) {
        setQuickShareError(copy.quickShareMissingTenant);
        return;
      }

      const payload = createShareRequestSchema.parse({
        resourceType: 'tenant_feed',
        resourceId: meResponse.tenantId
      });

      const createShareResponse = await apiRequest('/shares', {
        method: 'POST',
        body: payload,
        requestSchema: createShareRequestSchema,
        responseSchema: createShareResponseSchema
      });

      const permanentLink = buildPermanentShareLink(createShareResponse.share.shareToken);

      try {
        await navigator.clipboard.writeText(permanentLink);
        setQuickShareMessage(`${copy.quickShareSuccess}：${permanentLink}`);
      } catch {
        setQuickShareError(`${copy.quickShareFallback} ${permanentLink}`);
      }
    } catch (error) {
      setQuickShareError(formatActionError(error, copy.quickShareErrorFallback));
    } finally {
      setQuickSharePending(false);
    }
  }

  return (
    <div className="tenant-shell-bg h-[100svh] overflow-hidden">
      <div className="flex h-full w-full gap-2 p-2 sm:gap-3 sm:p-3 lg:gap-4 lg:p-4">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-y-auto border-r border-neutral-200 bg-white shadow-[0_16px_32px_rgba(0,0,0,0.08)] transition-transform duration-300 lg:relative lg:h-full lg:translate-x-0 lg:rounded-3xl lg:border lg:shadow-[0_8px_26px_rgba(0,0,0,0.08)]',
            'dark:border-neutral-800 dark:bg-neutral-950/96 dark:shadow-[0_20px_40px_rgba(0,0,0,0.45)]',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">{copy.workspace}</p>
            <div className="mt-2 flex items-center gap-2">
              <p className="text-3xl font-semibold leading-none text-neutral-900 dark:text-neutral-100">{displayTenantName}</p>
              <span className="inline-flex items-center rounded-full border border-[#FFD400]/45 bg-[#FFD400]/20 px-2 py-0.5 text-[11px] font-semibold text-neutral-900 dark:border-[#FFD400]/35 dark:bg-[#FFD400]/16 dark:text-[#ffe8a6]">
                {planLoading ? copy.planLoading : formatPlanBadgeLabel(currentPlan, locale)}
              </span>
            </div>
          </div>

          <nav className="space-y-1 px-3 py-4">
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
                      : 'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'
                  )}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                      active
                        ? 'bg-[#FFD400] text-black dark:bg-[#FFD400]/85 dark:text-neutral-900'
                        : 'bg-neutral-100 text-neutral-500 group-hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:group-hover:bg-neutral-800'
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  <span>{item.label[locale]}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-neutral-200 p-3 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start rounded-xl border-neutral-200 !bg-neutral-50 !text-neutral-800 shadow-none hover:!bg-neutral-100 hover:!text-neutral-900 [&_svg]:text-neutral-500 hover:[&_svg]:text-neutral-700 dark:border-neutral-700 dark:!bg-neutral-900 dark:!text-neutral-100 dark:hover:!bg-neutral-800 dark:[&_svg]:text-neutral-300 dark:hover:[&_svg]:text-neutral-100"
              onClick={() => void handleQuickShareCopy()}
              disabled={quickSharePending}
            >
              <Link2 size={16} />
              <span>{quickSharePending ? copy.quickSharePending : copy.createShare}</span>
            </Button>

            {quickShareError ? (
              <p className="mt-2 break-all rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {quickShareError}
              </p>
            ) : null}
            {quickShareMessage ? (
              <p className="mt-2 break-all rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {quickShareMessage}
              </p>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              className="mt-3 w-full justify-start text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              onClick={() => {
                clearAccessToken();
                router.replace('/login');
              }}
            >
              <LogOut size={16} />
              <span>{copy.logout}</span>
            </Button>

            <div className="mt-3">
              <UiPreferenceControls className="tenant-sidebar-pref" />
            </div>
          </div>
        </aside>

        <section className="flex h-full min-w-0 flex-1 flex-col">
          <header className="tenant-reveal mb-3 shrink-0 sm:hidden">
            <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-white/78 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.11)] backdrop-blur-xl dark:border-neutral-700 dark:bg-neutral-950/78 dark:shadow-[0_14px_30px_rgba(0,0,0,0.38)]">
              <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[#FFD400]/26 blur-2xl" />
              <div className="pointer-events-none absolute -left-8 -bottom-10 h-24 w-24 rounded-full bg-white/80 blur-2xl dark:bg-neutral-800/70" />
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.34em] text-neutral-500 dark:text-neutral-400">{copy.workspace}</p>
                  <h1 className="mt-1 truncate text-3xl font-semibold leading-none text-neutral-900 dark:text-neutral-100">
                    {displayTenantName}
                  </h1>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{activeLabel}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label={mobileNavOpen ? copy.closeMenu : copy.openMenu}
                  className="h-9 w-9 rounded-xl border border-white/90 bg-white/85 shadow-[0_4px_14px_rgba(0,0,0,0.1)] dark:border-neutral-700 dark:bg-neutral-900"
                  onClick={() => setMobileNavOpen((open) => !open)}
                >
                  {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
                </Button>
              </div>
              <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-[#FFD400]/24 px-2.5 py-1 text-[11px] font-semibold text-neutral-800 dark:bg-[#FFD400]/22 dark:text-[#ffe9a3]">
                  {copy.controlCenter.toUpperCase()}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/90 bg-white/80 px-2.5 py-1 text-[11px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  {activeLabel}
                </span>
              </div>
            </div>
          </header>

          <header className="tenant-reveal mb-3 hidden shrink-0 rounded-3xl border border-neutral-200/90 bg-white/95 px-4 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/90 dark:shadow-[0_14px_28px_rgba(0,0,0,0.35)] sm:block sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.26em] text-neutral-500 dark:text-neutral-400">{copy.workspace}</p>
                <h1 className="truncate text-3xl font-semibold text-neutral-900 dark:text-neutral-100 sm:text-4xl">
                  {displayTenantName}
                </h1>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{activeLabel}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={mobileNavOpen ? copy.closeMenu : copy.openMenu}
                className="lg:hidden"
                onClick={() => setMobileNavOpen((open) => !open)}
              >
                {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
              </Button>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="min-h-full pb-4">{children}</div>
          </div>
        </section>
      </div>

      {mobileNavOpen ? (
        <button
          type="button"
          aria-label={copy.closeSidebar}
          className="fixed inset-0 z-40 bg-black/35 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (/\/app\/[^/]+$/.test(href)) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildPermanentShareLink(shareToken: string) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/public/s/${shareToken}`;
  }

  return `/public/s/${shareToken}`;
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

function formatActionError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
