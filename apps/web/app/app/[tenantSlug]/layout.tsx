'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  createShareRequestSchema,
  createShareResponseSchema,
  meResponseSchema
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
import { ApiError, apiRequest, clearAccessToken } from '../../../lib/api-client';
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

type PlanComparisonRow = {
  metric: string;
  free: string;
  basic: string;
  pro: string;
};

type PlanComparisonConfig = {
  metricHeader: string;
  intro: string;
  note: string;
  guideLabel: string;
  guides: Array<{
    plan: PlanTier;
    text: string;
  }>;
  rows: PlanComparisonRow[];
};

const NAV_ITEMS: NavItem[] = [
  {
    label: { zh: '控制台', en: 'Dashboard' },
    href: (tenantSlug) => `/app/${tenantSlug}`,
    icon: LayoutDashboard
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
    planModalTitle: '套餐对比',
    planModalSubtitle: '按关键维度看差异，再决定是否升级。',
    planModalClose: '稍后再看',
    planModalUpgradeNow: '去升级套餐'
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
    planModalTitle: 'Plan Comparison',
    planModalSubtitle: 'Compare key dimensions before upgrading.',
    planModalClose: 'Later',
    planModalUpgradeNow: 'Upgrade now'
  }
} as const;

const PLAN_COMPARISON: Record<'zh' | 'en', PlanComparisonConfig> = {
  zh: {
    metricHeader: '对比维度',
    intro: '下面用同一张表横向展示 FREE / BASIC / PRO 的核心差异。',
    note: '具体数值配额请以“个人设置 > 套餐状态”页面中的实时数据为准。',
    guideLabel: '如何选择',
    guides: [
      { plan: 'FREE', text: '先验证流程与数据录入，适合起步阶段。' },
      { plan: 'BASIC', text: '已有稳定业务后升级，兼顾成本与容量。' },
      { plan: 'PRO', text: '适合多角色协作和持续增长场景。' }
    ],
    rows: [
      {
        metric: '适用阶段',
        free: '个人或小规模试运行',
        basic: '稳定运营中的小团队',
        pro: '规模化经营与增长期'
      },
      {
        metric: '数据与配额',
        free: '基础配额，满足早期验证',
        basic: '更高配额，覆盖日常运营',
        pro: '最高配额，支持弹性扩展'
      },
      {
        metric: '能力侧重点',
        free: '基础管理 + 标准分享',
        basic: '增强沉淀能力与持续使用',
        pro: '复杂业务场景与长期高频使用'
      },
      {
        metric: '协作规模',
        free: '1-2 人为主',
        basic: '小团队协作',
        pro: '多角色协作'
      }
    ]
  },
  en: {
    metricHeader: 'Dimension',
    intro: 'A side-by-side matrix of FREE / BASIC / PRO key differences.',
    note: 'For exact quota numbers, check real-time data in "Account > Subscription Status".',
    guideLabel: 'How to choose',
    guides: [
      { plan: 'FREE', text: 'Start here for workflow validation and early setup.' },
      { plan: 'BASIC', text: 'Best next step for stable daily operations.' },
      { plan: 'PRO', text: 'Ideal for multi-role collaboration and scaling.' }
    ],
    rows: [
      {
        metric: 'Best for',
        free: 'Individual or early trial',
        basic: 'Steady small-team operation',
        pro: 'Scale and growth stage'
      },
      {
        metric: 'Data & quota',
        free: 'Baseline quota for validation',
        basic: 'Higher quota for daily workload',
        pro: 'Top quota with flexible expansion'
      },
      {
        metric: 'Capability focus',
        free: 'Core management + standard sharing',
        basic: 'Stronger retention for steady usage',
        pro: 'Built for complex long-term workflows'
      },
      {
        metric: 'Collaboration size',
        free: 'Mainly 1-2 people',
        basic: 'Small team collaboration',
        pro: 'Multi-role collaboration'
      }
    ]
  }
} as const;

export default function TenantRouteLayout({ children }: TenantRouteLayoutProps) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = params.tenantSlug ?? '';
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [quickSharePending, setQuickSharePending] = useState(false);
  const [quickShareMessage, setQuickShareMessage] = useState<string | null>(null);
  const [quickShareError, setQuickShareError] = useState<string | null>(null);
  const { locale } = useUiPreferences();
  const copy = SHELL_COPY[locale];
  const planComparison = PLAN_COMPARISON[locale];
  const displayTenantName = useMemo(() => formatTenantDisplayName(tenantSlug, copy.defaultTenant), [tenantSlug, copy.defaultTenant]);

  const activeLabel = useMemo(() => {
    const matched = NAV_ITEMS.find((item) => isActive(pathname, item.href(tenantSlug)));
    return matched?.label[locale] ?? NAV_ITEMS[0].label[locale];
  }, [pathname, tenantSlug, locale]);

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
            'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-neutral-200 bg-white shadow-[0_16px_32px_rgba(0,0,0,0.08)] transition-transform duration-300 lg:relative lg:h-full lg:translate-x-0 lg:rounded-3xl lg:border lg:shadow-[0_8px_26px_rgba(0,0,0,0.08)]',
            'dark:border-neutral-800 dark:bg-neutral-950/96 dark:shadow-[0_20px_40px_rgba(0,0,0,0.45)]',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500 dark:text-neutral-400">{copy.workspace}</p>
            <p className="mt-2 text-3xl font-semibold leading-none text-neutral-900 dark:text-neutral-100">
              {displayTenantName}
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
              className="mb-2 w-full justify-start rounded-xl border-neutral-200 !bg-neutral-50 !text-neutral-800 shadow-none hover:!bg-neutral-100 hover:!text-neutral-900 [&_svg]:text-neutral-500 hover:[&_svg]:text-neutral-700 dark:border-neutral-700 dark:!bg-neutral-900 dark:!text-neutral-100 dark:hover:!bg-neutral-800 dark:[&_svg]:text-neutral-300 dark:hover:[&_svg]:text-neutral-100"
              onClick={() => {
                setMobileNavOpen(false);
                setIsPlanModalOpen(true);
              }}
            >
              <Wallet size={16} />
              <span>{copy.upgradePlan}</span>
            </Button>
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

      {isPlanModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={copy.planModalTitle}
          onClick={() => setIsPlanModalOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.2)] dark:border-neutral-800 dark:bg-neutral-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{copy.planModalTitle}</h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{copy.planModalSubtitle}</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{planComparison.intro}</p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900">
                    <th className="border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300 sm:px-4 sm:text-sm">
                      {planComparison.metricHeader}
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100 sm:px-4 sm:text-sm">
                      FREE
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100 sm:px-4 sm:text-sm">
                      BASIC
                    </th>
                    <th className="border-b border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-100 sm:px-4 sm:text-sm">
                      PRO
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {planComparison.rows.map((row) => (
                    <tr key={row.metric}>
                      <th className="border-b border-neutral-200 bg-neutral-50/80 px-3 py-2 align-top text-xs font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/65 dark:text-neutral-200 sm:px-4 sm:text-sm">
                        {row.metric}
                      </th>
                      <td className="border-b border-neutral-200 px-3 py-2 align-top text-xs text-neutral-700 dark:border-neutral-800 dark:text-neutral-200 sm:px-4 sm:text-sm">
                        {row.free}
                      </td>
                      <td className="border-b border-neutral-200 bg-neutral-50/35 px-3 py-2 align-top text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/35 dark:text-neutral-200 sm:px-4 sm:text-sm">
                        {row.basic}
                      </td>
                      <td className="border-b border-neutral-200 px-3 py-2 align-top text-xs text-neutral-700 dark:border-neutral-800 dark:text-neutral-200 sm:px-4 sm:text-sm">
                        {row.pro}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{planComparison.note}</p>

            <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{planComparison.guideLabel}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {planComparison.guides.map((guide) => (
                  <p
                    key={guide.plan}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
                  >
                    <span className="font-semibold">{guide.plan}：</span>
                    {guide.text}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setIsPlanModalOpen(false)}>
                {copy.planModalClose}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setIsPlanModalOpen(false);
                  router.push(`/app/${tenantSlug}/account#subscription-plan`);
                }}
              >
                {copy.planModalUpgradeNow}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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

function formatActionError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
