'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  dashboardOverviewResponseSchema,
  meResponseSchema,
  type DashboardOverviewResponse,
  type DashboardOverviewWindow,
} from '@eggturtle/shared';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  HeartHandshake,
  Plus,
  QrCode,
  Share2,
  Shell,
  Workflow,
} from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { ensureTenantRouteSession } from '@/lib/tenant-route-session';
import TenantShareDialogTrigger from '@/components/tenant-share-dialog-trigger';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FloatingActionButton,
  FloatingActionDock,
} from '@/components/ui/floating-actions';
import TenantFloatingShareButton from '@/components/tenant-floating-share-button';

const WINDOW_OPTIONS: Array<{ key: DashboardOverviewWindow; label: string; shortLabel: string }> = [
  { key: 'today', label: '今日', shortLabel: '今日' },
  { key: '7d', label: '近 7 天', shortLabel: '近 7 天' },
  { key: '30d', label: '近 30 天', shortLabel: '近 30 天' },
];

type DrilldownQueryValue = string | number | null | undefined;

function buildRoute(
  pathname: string,
  query?: Record<string, DrilldownQueryValue>,
  hash?: string,
) {
  const params = new URLSearchParams();

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) {
        continue;
      }

      const normalized = String(value).trim();
      if (!normalized) {
        continue;
      }

      params.set(key, normalized);
    }
  }

  const queryString = params.toString();
  return `${pathname}${queryString ? `?${queryString}` : ''}${hash ? `#${hash}` : ''}`;
}

function DashboardLoadingState() {
  return (
    <section className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden rounded-[2rem] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,246,241,0.92))] px-5 py-12 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:min-h-[460px] sm:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/35 blur-3xl dashboard-loading-orb dashboard-loading-orb-delay" />
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/25 backdrop-blur-3xl" />
        <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-70" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[22rem] flex-col items-center text-center">
        <div className="dashboard-loading-float relative mb-7 flex h-24 w-24 items-center justify-center rounded-[30px] border border-white/80 bg-white/75 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
          <div className="absolute inset-[10px] rounded-[24px] border border-stone-200/70 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),rgba(245,244,240,0.88))]" />
          <div className="relative flex items-end gap-1.5">
            <span className="dashboard-loading-bar h-7 w-2.5 rounded-full bg-stone-900/80" />
            <span className="dashboard-loading-bar dashboard-loading-bar-delay-1 h-11 w-2.5 rounded-full bg-amber-400/95" />
            <span className="dashboard-loading-bar dashboard-loading-bar-delay-2 h-8 w-2.5 rounded-full bg-stone-500/75" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-stone-400">Dashboard</p>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl">正在同步你的仪表盘</h2>
          <p className="mx-auto max-w-xs text-sm leading-6 text-stone-500">
            稍等片刻，系统正在整理今日数据与分享动态。
          </p>
        </div>

        <div className="mt-7 flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/70 px-3 py-2 text-[11px] font-medium tracking-[0.18em] text-stone-500 shadow-sm backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dashboard-loading-dot" />
          <span className="h-1.5 w-1.5 rounded-full bg-stone-300 dashboard-loading-dot dashboard-loading-dot-delay" />
          <span>数据载入中</span>
        </div>
      </div>

      <style jsx>{`
        .dashboard-loading-float {
          animation: dashboard-float 4.8s ease-in-out infinite;
        }

        .dashboard-loading-bar {
          transform-origin: center bottom;
          animation: dashboard-bar 1.8s ease-in-out infinite;
        }

        .dashboard-loading-bar-delay-1 {
          animation-delay: 0.2s;
        }

        .dashboard-loading-bar-delay-2 {
          animation-delay: 0.4s;
        }

        .dashboard-loading-dot {
          animation: dashboard-dot 1.6s ease-in-out infinite;
        }

        .dashboard-loading-dot-delay {
          animation-delay: 0.8s;
        }

        .dashboard-loading-orb {
          animation: dashboard-orb 7s ease-in-out infinite;
        }

        .dashboard-loading-orb-delay {
          animation-delay: 1.2s;
        }

        @keyframes dashboard-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @keyframes dashboard-bar {
          0%,
          100% {
            transform: scaleY(0.88);
            opacity: 0.72;
          }
          50% {
            transform: scaleY(1.08);
            opacity: 1;
          }
        }

        @keyframes dashboard-dot {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(0.88);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes dashboard-orb {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(0.94);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.06);
            opacity: 0.95;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dashboard-loading-float,
          .dashboard-loading-bar,
          .dashboard-loading-dot,
          .dashboard-loading-orb {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}

export default function TenantAppPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [tenantReady, setTenantReady] = useState(false);
  const [activeWindow, setActiveWindow] = useState<DashboardOverviewWindow>('30d');
  const [overviewByWindow, setOverviewByWindow] = useState<
    Partial<Record<DashboardOverviewWindow, DashboardOverviewResponse>>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTenantReady(false);
    setOverviewByWindow({});
    setActiveWindow('30d');
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const access = await ensureTenantRouteSession({
          tenantSlug,
          missingTenantMessage: '缺少 tenantSlug。',
          router,
        });
        if (!access.ok) {
          if (!cancelled && access.reason === 'missing-tenant') {
            setError(access.message ?? '缺少 tenantSlug。');
            setLoading(false);
          }
          return;
        }

        await apiRequest('/me', { responseSchema: meResponseSchema });

        if (cancelled) {
          return;
        }

        setTenantReady(true);
      } catch (nextError) {
        if (!cancelled) {
          setError(formatApiError(nextError));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, tenantSlug]);

  useEffect(() => {
    if (!tenantReady) {
      return;
    }

    if (overviewByWindow[activeWindow]) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const nextOverview = await apiRequest(`/dashboard/overview?window=${activeWindow}`, {
          responseSchema: dashboardOverviewResponseSchema,
        });

        if (cancelled) {
          return;
        }

        setOverviewByWindow((current) => ({
          ...current,
          [activeWindow]: nextOverview,
        }));
        setLoading(false);
      } catch (nextError) {
        if (!cancelled) {
          setError(formatApiError(nextError));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWindow, overviewByWindow, tenantReady]);

  const overview = overviewByWindow[activeWindow] ?? null;
  const metricLinks = useMemo(() => {
    const baseQuery = {
      from: 'dashboard',
      window: activeWindow,
    };

    const buildProductsDrilldown = (
      metric: string,
      query?: Record<string, DrilldownQueryValue>,
    ) => {
      return buildRoute(`/app/${tenantSlug}/products`, {
        ...baseQuery,
        metric,
        ...query,
      });
    };

    return {
      eggsTotal: buildProductsDrilldown('eggs_total', {
        sex: 'female',
        sortBy: 'updatedAt',
        sortDir: 'desc',
      }),
      eggsEvents: buildProductsDrilldown('eggs_events', {
        sex: 'female',
        sortBy: 'updatedAt',
        sortDir: 'desc',
      }),
      matingEvents: buildProductsDrilldown('mating_events', {
        sortBy: 'updatedAt',
        sortDir: 'desc',
      }),
      needMating: buildProductsDrilldown('need_mating', {
        sex: 'female',
        status: 'need_mating',
      }),
      warnings: buildProductsDrilldown('warnings', {
        sex: 'female',
        status: 'warning',
      }),
      shareUv: buildRoute(`/app/${tenantSlug}`, {
        ...baseQuery,
        metric: 'share_uv',
      }, 'share-clicks-list'),
      sharePv: buildRoute(`/app/${tenantSlug}`, {
        ...baseQuery,
        metric: 'share_pv',
      }, 'share-clicks-list'),
    };
  }, [activeWindow, tenantSlug]);

  function openMetricLink(href: string) {
    router.push(href);
  }

  function jumpToShareClicks(fallbackHref: string) {
    if (typeof document !== 'undefined') {
      const target = document.getElementById('share-clicks-list');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    openMetricLink(fallbackHref);
  }

  if (loading) {
    return (
      <main className="pb-16 sm:pb-8">
        <DashboardLoadingState />
      </main>
    );
  }

  return (
    <main className="space-y-4 pb-16 sm:space-y-6 sm:pb-8">
      {error ? (
        <Card className="rounded-3xl border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}


      {!loading && !error && overview ? (
        <>
          <Card className="tenant-card-lift relative overflow-hidden rounded-3xl border-neutral-200/90 bg-white p-6 transition-all sm:p-7">
            <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-[#FFD400]/20 blur-3xl" />
            <CardHeader className="relative z-10 p-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <Badge variant="accent" className="w-fit">
                    数据总览
                  </Badge>
                  <CardTitle className="text-2xl text-neutral-900 sm:text-3xl">
                    核心指标看板
                  </CardTitle>
                  <CardDescription className="text-neutral-600">
                    使用同一套视图切换时间窗口，快速对比趋势变化。
                  </CardDescription>
                </div>
                <div className="hidden shrink-0 items-center gap-1 rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-100/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.08)] sm:flex">
                  {WINDOW_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={activeWindow === item.key}
                      className={`rounded-xl border px-3.5 py-1.5 text-sm font-semibold leading-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-1 ${
                        activeWindow === item.key
                          ? 'border-neutral-900 bg-neutral-900 text-white shadow-[0_6px_14px_rgba(15,23,42,0.28)]'
                          : 'border-transparent bg-transparent text-neutral-700 hover:border-neutral-300 hover:bg-white hover:text-neutral-900'
                      }`}
                      onClick={() => setActiveWindow(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50/85 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:hidden">
                <div className="grid grid-cols-3 gap-1">
                  {WINDOW_OPTIONS.map((item) => (
                    <button
                      key={`window-mobile-chip-${item.key}`}
                      type="button"
                      aria-pressed={activeWindow === item.key}
                      className={`rounded-xl px-2 py-2 text-xs font-semibold leading-none transition ${
                        activeWindow === item.key
                          ? 'bg-neutral-900 text-white shadow-[0_8px_16px_rgba(15,23,42,0.25)]'
                          : 'bg-transparent text-neutral-700 hover:bg-white hover:text-neutral-900'
                      }`}
                      onClick={() => setActiveWindow(item.key)}
                    >
                      {item.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-2 text-[11px] text-neutral-600">
                  当前窗口：产蛋 {overview.eggs.totalEggCount} · 配对 {overview.matings.eventCount}{' '}
                  · 访问 UV {overview.share.uv}
                </p>
              </div>
            </CardHeader>
          </Card>

          <section className="space-y-3 sm:hidden">
            <Card className="rounded-2xl border-neutral-200/90 bg-white p-4">
              <CardHeader className="p-0">
                <CardTitle className="text-base">繁育概览</CardTitle>
                <CardDescription className="text-xs">先看产蛋与配对主线指标。</CardDescription>
              </CardHeader>
              <CardContent className="mt-3 grid grid-cols-3 gap-2 p-0">
                <CompactStat
                  label="产蛋总数"
                  value={overview.eggs.totalEggCount}
                  onClick={() => openMetricLink(metricLinks.eggsTotal)}
                />
                <CompactStat
                  label="产蛋事件"
                  value={overview.eggs.eventCount}
                  onClick={() => openMetricLink(metricLinks.eggsEvents)}
                />
                <CompactStat
                  label="配对事件"
                  value={overview.matings.eventCount}
                  onClick={() => openMetricLink(metricLinks.matingEvents)}
                />
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <CompactKpiCard
                label="待配对"
                value={overview.needMating.needMatingCount}
                icon={<HeartHandshake size={14} />}
                onClick={() => openMetricLink(metricLinks.needMating)}
              />
              <CompactKpiCard
                label="预警"
                value={overview.needMating.warningCount}
                icon={<AlertTriangle size={14} />}
                onClick={() => openMetricLink(metricLinks.warnings)}
              />
              <CompactKpiCard
                label="分享 UV"
                value={overview.share.uv}
                hint="访问人数"
                icon={<Share2 size={14} />}
                onClick={() => jumpToShareClicks(metricLinks.shareUv)}
              />
              <CompactKpiCard
                label="页面访问"
                value={overview.share.pv}
                hint="总访问量"
                icon={<QrCode size={14} />}
                onClick={() => jumpToShareClicks(metricLinks.sharePv)}
              />
            </div>
          </section>

          <section className="hidden grid-cols-2 gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard
              label="产蛋总数"
              value={overview.eggs.totalEggCount}
              hint="产蛋总量"
              icon={<Shell size={16} />}
              onClick={() => openMetricLink(metricLinks.eggsTotal)}
            />
            <KpiCard
              label="产蛋事件"
              value={overview.eggs.eventCount}
              hint="产蛋次数"
              icon={<CalendarDays size={16} />}
              onClick={() => openMetricLink(metricLinks.eggsEvents)}
            />
            <KpiCard
              label="配对事件"
              value={overview.matings.eventCount}
              hint="配对次数"
              icon={<Workflow size={16} />}
              onClick={() => openMetricLink(metricLinks.matingEvents)}
            />
            <KpiCard
              label="需配对"
              value={overview.needMating.needMatingCount}
              hint="待配对数量"
              icon={<HeartHandshake size={16} />}
              onClick={() => openMetricLink(metricLinks.needMating)}
            />
            <KpiCard
              label="预警"
              value={overview.needMating.warningCount}
              hint="预警数量"
              icon={<AlertTriangle size={16} />}
              onClick={() => openMetricLink(metricLinks.warnings)}
            />
            <KpiCard
              label="分享 UV"
              value={overview.share.uv}
              hint={`页面访问 ${overview.share.pv}`}
              icon={<Share2 size={16} />}
              onClick={() => jumpToShareClicks(metricLinks.shareUv)}
            />
          </section>

          <section className="grid grid-cols-1 gap-4">
            <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
              <CardHeader>
                <CardTitle className="text-2xl">产蛋/配对趋势</CardTitle>
                <CardDescription>无图表依赖，按窗口展示每日柱状对比。</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleBarChart chart={overview.chart} />
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-4">
            <Card
              id="share-clicks-list"
              className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all"
            >
              <CardHeader>
                <CardTitle className="text-2xl">热门点击榜</CardTitle>
                <CardDescription>取分享访问日志中的产品点击统计（窗口内）。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.share.productClicksTop.length === 0 ? (
                  <p className="text-sm text-neutral-500">当前窗口暂无点击数据。</p>
                ) : null}
                {overview.share.productClicksTop.map((item, index) => (
                  <button
                    key={item.productId}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left transition hover:border-neutral-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-1"
                    onClick={() =>
                      router.push(
                        buildRoute(`/app/${tenantSlug}/breeders/${item.productId}`, {
                          from: 'dashboard',
                          window: activeWindow,
                          source: 'share_clicks_top',
                        }),
                      )
                    }
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        #{index + 1} · {item.code}
                      </p>
                      <p className="text-xs text-neutral-500">点击查看该个体详情</p>
                    </div>
                    <p className="text-lg font-bold text-neutral-900">
                      {item.clicks}
                      <span className="ml-1 inline-block align-middle text-neutral-400">
                        <ChevronRight size={14} />
                      </span>
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}

      <FloatingActionDock className="lg:hidden">
        <FloatingActionButton
          aria-label="打开快捷操作"
          onClick={() => setIsActionSheetOpen(true)}
        >
          <Plus size={18} />
        </FloatingActionButton>
        <TenantFloatingShareButton intent="feed" inline className="h-11 w-11" />
      </FloatingActionDock>

      {isActionSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/35 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="快捷操作"
          onClick={() => setIsActionSheetOpen(false)}
        >
          <Card
            className="mx-auto w-[min(92vw,34rem)] rounded-3xl border-neutral-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className="text-xl">快捷操作</CardTitle>
              <CardDescription>面向移动端：分享、二维码、快速记录。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <TenantShareDialogTrigger
                intent="feed"
                trigger={({ onClick, pending }) => (
                  <ActionButton
                    icon={<Share2 size={16} />}
                    label={pending ? '正在准备分享弹窗' : '打开分享弹窗'}
                    onClick={() => {
                      setIsActionSheetOpen(false);
                      onClick();
                    }}
                  />
                )}
              />
              <ActionButton
                icon={<Shell size={16} />}
                label="记录产蛋（跳转产品页）"
                onClick={() => {
                  router.push(`/app/${tenantSlug}/products?intent=egg`);
                  setIsActionSheetOpen(false);
                }}
              />
              <ActionButton
                icon={<Workflow size={16} />}
                label="记录配对（跳转产品页）"
                onClick={() => {
                  router.push(`/app/${tenantSlug}/products?intent=mating`);
                  setIsActionSheetOpen(false);
                }}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

    </main>
  );
}

function KpiCard(props: {
  label: string;
  value: number | string;
  hint?: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const card = (
    <Card
      className={`tenant-card-lift rounded-2xl border-neutral-200/90 bg-white p-4 transition-all ${
        props.onClick
          ? 'cursor-pointer group-hover:-translate-y-0.5 group-hover:border-neutral-300 group-hover:shadow-[0_14px_28px_rgba(15,23,42,0.10)]'
          : ''
      }`}
    >
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-700">{props.label}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFD400]/15 text-neutral-800">
            {props.icon}
          </span>
        </div>
      </CardHeader>
      <CardContent className="mt-3 p-0">
        <p className="text-3xl font-black leading-none text-neutral-900">{props.value}</p>
        {props.hint ? <p className="mt-1 text-xs text-neutral-500">{props.hint}</p> : null}
        {props.onClick ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-500">
            查看列表
            <ChevronRight size={12} />
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!props.onClick) {
    return card;
  }

  return (
    <button
      type="button"
      className="group w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-1"
      onClick={props.onClick}
      aria-label={`${props.label}，查看详情列表`}
    >
      {card}
    </button>
  );
}

function CompactStat(props: { label: string; value: number | string; onClick?: () => void }) {
  if (!props.onClick) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2">
        <p className="text-[11px] text-neutral-500">{props.label}</p>
        <p className="mt-1 text-lg font-black leading-none text-neutral-900">{props.value}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2 text-left transition hover:border-neutral-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-1"
      onClick={props.onClick}
      aria-label={`${props.label}，查看详情列表`}
    >
      <p className="text-[11px] text-neutral-500">{props.label}</p>
      <div className="mt-1 flex items-center justify-between">
        <p className="text-lg font-black leading-none text-neutral-900">{props.value}</p>
        <ChevronRight size={12} className="text-neutral-400 transition group-hover:text-neutral-600" />
      </div>
    </button>
  );
}

function CompactKpiCard(props: {
  label: string;
  value: number | string;
  hint?: string;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const card = (
    <Card
      className={`rounded-2xl border-neutral-200/90 bg-white p-3 transition ${
        props.onClick
          ? 'cursor-pointer group-hover:-translate-y-0.5 group-hover:border-neutral-300 group-hover:shadow-[0_12px_22px_rgba(15,23,42,0.08)]'
          : ''
      }`}
    >
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-neutral-700">{props.label}</p>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFD400]/18 text-neutral-800">
            {props.icon}
          </span>
        </div>
      </CardHeader>
      <CardContent className="mt-2 p-0">
        <p className="text-3xl font-black leading-none text-neutral-900">{props.value}</p>
        <div className="mt-1 flex items-center justify-between">
          {props.hint ? <p className="text-xs text-neutral-500">{props.hint}</p> : <span aria-hidden className="h-4" />}
          {props.onClick ? (
            <ChevronRight size={12} className="text-neutral-400 transition group-hover:text-neutral-600" />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (!props.onClick) {
    return card;
  }

  return (
    <button
      type="button"
      className="group w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-1"
      onClick={props.onClick}
      aria-label={`${props.label}，查看详情列表`}
    >
      {card}
    </button>
  );
}

function SimpleBarChart(props: { chart: DashboardOverviewResponse['chart'] }) {
  const maxValue = Math.max(1, ...props.chart.flatMap((item) => [item.eggCount, item.matingCount]));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#FFD400]" /> 产蛋数
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-neutral-900" /> 配对事件
        </span>
      </div>

      <div className="flex min-h-[200px] items-end gap-2 overflow-x-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
        {props.chart.map((item) => {
          const eggHeight = `${Math.max((item.eggCount / maxValue) * 100, item.eggCount > 0 ? 6 : 0)}%`;
          const matingHeight = `${Math.max((item.matingCount / maxValue) * 100, item.matingCount > 0 ? 6 : 0)}%`;
          const label = formatChartDate(item.date, props.chart.length === 1);

          return (
            <div key={item.date} className="min-w-[56px] flex-1">
              <div className="flex h-36 items-end justify-center gap-1.5">
                <div
                  className="w-4 rounded-md bg-[#FFD400]"
                  style={{ height: eggHeight }}
                  title={`产蛋数 ${item.eggCount}`}
                />
                <div
                  className="w-4 rounded-md bg-neutral-900"
                  style={{ height: matingHeight }}
                  title={`配对事件 ${item.matingCount}`}
                />
              </div>
              <p className="mt-2 text-center text-[11px] text-neutral-500">{label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionButton(props: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="group flex w-full items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-700 transition hover:border-neutral-300 hover:bg-white hover:text-neutral-900"
      onClick={props.onClick}
    >
      <span className="text-neutral-500 transition-colors group-hover:text-neutral-700">
        {props.icon}
      </span>
      <span>{props.label}</span>
    </button>
  );
}

function formatChartDate(value: string, isSingle: boolean) {
  if (isSingle) {
    return '今日';
  }

  const segments = value.split('-');
  if (segments.length !== 3) {
    return value;
  }

  return `${segments[1]}-${segments[2]}`;
}
