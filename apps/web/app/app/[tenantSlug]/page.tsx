'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  createShareRequestSchema,
  createShareResponseSchema,
  dashboardOverviewResponseSchema,
  meResponseSchema,
  type DashboardOverviewResponse,
  type DashboardOverviewWindow
} from '@eggturtle/shared';
import {
  AlertTriangle,
  CalendarDays,
  Copy,
  ExternalLink,
  HeartHandshake,
  Link2,
  Plus,
  QrCode,
  Share2,
  Shell,
  Workflow
} from 'lucide-react';

import { ApiError, apiRequest, getAccessToken } from '../../../lib/api-client';
import { formatTenantDisplayName } from '../../../lib/tenant-display';
import { switchTenantBySlug } from '../../../lib/tenant-session';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';

type ShareLinks = {
  shareToken: string;
  entryUrl: string;
  permanentUrl: string;
};

const WINDOW_OPTIONS: Array<{ key: DashboardOverviewWindow; label: string; shortLabel: string }> = [
  { key: 'today', label: '今日', shortLabel: 'Today' },
  { key: '7d', label: '近 7 天', shortLabel: '7d' },
  { key: '30d', label: '近 30 天', shortLabel: '30d' }
];

const NEED_MATING_CARDS = [
  {
    key: 'need' as const,
    title: '待配对',
    hint: '已产蛋且暂无新配对'
  },
  {
    key: 'warning' as const,
    title: '预警',
    hint: '待配对天数超过阈值'
  }
];

export default function TenantAppPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const displayTenantName = useMemo(() => formatTenantDisplayName(tenantSlug, '蛋龟选育库'), [tenantSlug]);

  const [tenantReady, setTenantReady] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [activeWindow, setActiveWindow] = useState<DashboardOverviewWindow>('today');
  const [activeNeedMatingCard, setActiveNeedMatingCard] = useState<'need' | 'warning'>('need');
  const [overviewByWindow, setOverviewByWindow] = useState<Partial<Record<DashboardOverviewWindow, DashboardOverviewResponse>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shareLinks, setShareLinks] = useState<ShareLinks | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setError('缺少 tenantSlug。');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setTenantReady(false);
    setTenantId(null);
    setOverviewByWindow({});
    setActiveWindow('today');
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        const me = await apiRequest('/me', { responseSchema: meResponseSchema });

        if (cancelled) {
          return;
        }

        setTenantId(me.tenantId ?? null);
        setTenantReady(true);
      } catch (nextError) {
        if (!cancelled) {
          setError(formatError(nextError));
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
          responseSchema: dashboardOverviewResponseSchema
        });

        if (cancelled) {
          return;
        }

        setOverviewByWindow((current) => ({
          ...current,
          [activeWindow]: nextOverview
        }));
        setLoading(false);
      } catch (nextError) {
        if (!cancelled) {
          setError(formatError(nextError));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWindow, overviewByWindow, tenantReady]);

  const overview = overviewByWindow[activeWindow] ?? null;
  const needMatingValue = overview
    ? activeNeedMatingCard === 'need'
      ? overview.needMating.needMatingCount
      : overview.needMating.warningCount
    : 0;

  async function ensureShareLinks() {
    if (shareLinks) {
      return shareLinks;
    }

    if (!tenantId) {
      setShareError('当前会话没有 tenantId，无法生成分享链接。');
      return null;
    }

    setShareLoading(true);
    setShareError(null);
    setShareMessage(null);

    try {
      const payload = createShareRequestSchema.parse({
        resourceType: 'tenant_feed',
        resourceId: tenantId
      });

      const response = await apiRequest('/shares', {
        method: 'POST',
        body: payload,
        requestSchema: createShareRequestSchema,
        responseSchema: createShareResponseSchema
      });

      const nextLinks: ShareLinks = {
        shareToken: response.share.shareToken,
        entryUrl: response.share.entryUrl,
        permanentUrl: buildPermanentShareLink(response.share.shareToken)
      };

      setShareLinks(nextLinks);
      return nextLinks;
    } catch (nextError) {
      setShareError(formatError(nextError));
      return null;
    } finally {
      setShareLoading(false);
    }
  }

  async function handleGenerateShareLink() {
    const links = await ensureShareLinks();
    if (!links) {
      return;
    }

    setShareMessage('分享入口已准备好，可复制给访客。');
    setShareError(null);
  }

  async function handleCopyPermanentShareLink() {
    const links = await ensureShareLinks();
    if (!links) {
      return;
    }

    const fallback = links.permanentUrl || links.entryUrl;

    try {
      await navigator.clipboard.writeText(fallback);
      setShareMessage(`已复制：${fallback}`);
      setShareError(null);
    } catch (nextError) {
      setShareError(formatError(nextError));
    }
  }

  return (
    <main className="space-y-4 pb-28 sm:space-y-6 sm:pb-8">
      {loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white/90 p-8">
          <p className="text-sm text-neutral-600">正在加载租户仪表盘...</p>
        </Card>
      ) : null}

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
                    DASHBOARD V2
                  </Badge>
                  <CardTitle className="text-3xl text-neutral-900 sm:text-4xl">{displayTenantName}</CardTitle>
                  <CardDescription className="text-neutral-600">核心指标统一到一个面板，切换时间窗即可对比趋势。</CardDescription>
                </div>
                <div className="hidden shrink-0 items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-1 sm:flex">
                  {WINDOW_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                        activeWindow === item.key
                          ? 'bg-neutral-900 text-white shadow-sm'
                          : 'text-neutral-600 hover:bg-neutral-200/70'
                      }`}
                      onClick={() => setActiveWindow(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
          </Card>

          <section className="sm:hidden">
            <div className="flex snap-x gap-3 overflow-x-auto pb-1">
              {WINDOW_OPTIONS.map((item) => {
                const itemData = overviewByWindow[item.key];
                const eggs = itemData?.eggs.totalEggCount ?? 0;
                const mating = itemData?.matings.eventCount ?? 0;
                return (
                  <button
                    key={`window-mobile-${item.key}`}
                    type="button"
                    className={`min-w-[76%] snap-start rounded-2xl border p-4 text-left transition ${
                      activeWindow === item.key
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-900'
                    }`}
                    onClick={() => setActiveWindow(item.key)}
                  >
                    <p className="text-xs uppercase tracking-[0.15em] opacity-75">{item.shortLabel}</p>
                    <p className="mt-2 text-xl font-black leading-none">{item.label}</p>
                    <p className="mt-2 text-xs opacity-80">产蛋数 {eggs} · 配对事件 {mating}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="产蛋总数" value={overview.eggs.totalEggCount} hint="Egg Count" icon={<Shell size={16} />} />
            <KpiCard label="产蛋事件" value={overview.eggs.eventCount} hint="Egg Events" icon={<CalendarDays size={16} />} />
            <KpiCard label="配对事件" value={overview.matings.eventCount} hint="Mating Events" icon={<Workflow size={16} />} />
            <KpiCard label="需配对" value={overview.needMating.needMatingCount} hint="Need Mating" icon={<HeartHandshake size={16} />} />
            <KpiCard label="预警" value={overview.needMating.warningCount} hint="Warning" icon={<AlertTriangle size={16} />} />
            <KpiCard label="分享 UV" value={overview.share.uv} hint={`PV ${overview.share.pv}`} icon={<Share2 size={16} />} />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
            <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
              <CardHeader>
                <CardTitle className="text-2xl">产蛋/配对趋势</CardTitle>
                <CardDescription>无图表依赖，按窗口展示每日柱状对比。</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleBarChart chart={overview.chart} />
              </CardContent>
            </Card>

            <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
              <CardHeader>
                <CardTitle className="text-2xl">待配对看板</CardTitle>
                <CardDescription>卡片切换关注重点，先处理风险更高项。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible">
                  {NEED_MATING_CARDS.map((item) => {
                    const value = item.key === 'need' ? overview.needMating.needMatingCount : overview.needMating.warningCount;
                    const active = activeNeedMatingCard === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`min-w-[76%] snap-start rounded-2xl border px-4 py-3 text-left transition sm:min-w-0 ${
                          active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50'
                        }`}
                        onClick={() => setActiveNeedMatingCard(item.key)}
                      >
                        <p className="text-xs uppercase tracking-[0.16em] opacity-75">{item.title}</p>
                        <p className="mt-1 text-3xl font-black leading-none">{value}</p>
                        <p className="mt-1 text-xs opacity-80">{item.hint}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
                  当前关注：
                  <span className="ml-1 font-semibold text-neutral-900">
                    {activeNeedMatingCard === 'need' ? '待配对' : '预警'} {needMatingValue} 项
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
              <CardHeader>
                <CardTitle className="text-2xl">分享入口</CardTitle>
                <CardDescription>优先复制稳定短链，不再暴露 exp/sig 参数。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-neutral-700">
                <div className="space-y-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-neutral-500">Permanent Link</p>
                  <p className="break-all text-xs text-neutral-800">{shareLinks?.permanentUrl ?? '点击「生成分享链接」后可复制稳定短链。'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" disabled={shareLoading} onClick={() => void handleGenerateShareLink()}>
                    <Link2 size={14} />
                    {shareLoading ? '生成中...' : '生成分享链接'}
                  </Button>
                  <Button variant="secondary" size="sm" disabled={shareLoading} onClick={() => void handleCopyPermanentShareLink()}>
                    <Copy size={14} />
                    复制永久链接
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!shareLinks?.permanentUrl}
                    onClick={() => {
                      if (!shareLinks?.permanentUrl) {
                        return;
                      }
                      window.open(shareLinks.permanentUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <ExternalLink size={14} />
                    打开预览
                  </Button>
                </div>
                {shareMessage ? <p className="text-xs font-medium text-emerald-700">{shareMessage}</p> : null}
                {shareError ? <p className="text-xs font-medium text-red-700">{shareError}</p> : null}
              </CardContent>
            </Card>

            <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
              <CardHeader>
                <CardTitle className="text-2xl">热门点击 TOP</CardTitle>
                <CardDescription>取分享访问日志中的产品点击统计（窗口内）。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.share.productClicksTop.length === 0 ? (
                  <p className="text-sm text-neutral-500">当前窗口暂无点击数据。</p>
                ) : null}
                {overview.share.productClicksTop.map((item, index) => (
                  <div key={item.productId} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">#{index + 1} · {item.code}</p>
                      <p className="text-xs text-neutral-500">Product ID: {item.productId}</p>
                    </div>
                    <p className="text-lg font-bold text-neutral-900">{item.clicks}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-5 z-40 h-12 w-12 rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.22)] lg:hidden"
        aria-label="打开快捷操作"
        onClick={() => setIsActionSheetOpen(true)}
      >
        <Plus size={18} />
      </Button>

      {isActionSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/35 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="快捷操作"
          onClick={() => setIsActionSheetOpen(false)}
        >
          <Card className="w-full rounded-3xl border-neutral-200 bg-white" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-xl">快捷操作</CardTitle>
              <CardDescription>面向移动端：分享、二维码、快速记录。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ActionButton
                icon={<Link2 size={16} />}
                label="生成分享链接"
                onClick={() => {
                  void handleGenerateShareLink();
                  setIsActionSheetOpen(false);
                }}
              />
              <ActionButton
                icon={<Copy size={16} />}
                label="复制永久分享链接"
                onClick={() => {
                  void handleCopyPermanentShareLink();
                  setIsActionSheetOpen(false);
                }}
              />
              <ActionButton
                icon={<QrCode size={16} />}
                label="生成二维码卡片（M1 占位）"
                onClick={() => {
                  setIsQrModalOpen(true);
                  setIsActionSheetOpen(false);
                }}
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

      {isQrModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="二维码卡片"
          onClick={() => setIsQrModalOpen(false)}
        >
          <Card className="w-full max-w-sm rounded-2xl border-neutral-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-xl">二维码卡片</CardTitle>
              <CardDescription>M1 先提供占位与可复制链接，M2 接入本地二维码渲染。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50">
                <div className="text-center text-sm text-neutral-500">
                  <QrCode size={24} className="mx-auto mb-2" />
                  QR 卡片占位（M1）
                </div>
              </div>
              <p className="break-all rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                {shareLinks?.permanentUrl ?? '先点击「生成分享链接」获得永久链接。'}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setIsQrModalOpen(false)}>
                  关闭
                </Button>
                <Button onClick={() => void handleCopyPermanentShareLink()}>复制链接</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}

function KpiCard(props: { label: string; value: number | string; hint: string; icon: ReactNode }) {
  return (
    <Card className="tenant-card-lift rounded-2xl border-neutral-200/90 bg-white p-4 transition-all">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">{props.hint}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFD400]/15 text-neutral-800">{props.icon}</span>
        </div>
      </CardHeader>
      <CardContent className="mt-4 p-0">
        <p className="text-3xl font-black leading-none text-neutral-900">{props.value}</p>
        <p className="mt-1 text-xs text-neutral-600">{props.label}</p>
      </CardContent>
    </Card>
  );
}

function SimpleBarChart(props: { chart: DashboardOverviewResponse['chart'] }) {
  const maxValue = Math.max(
    1,
    ...props.chart.flatMap((item) => [item.eggCount, item.matingCount])
  );

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
      className="flex w-full items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-800 transition hover:bg-neutral-100"
      onClick={props.onClick}
    >
      <span className="text-neutral-500">{props.icon}</span>
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

function buildPermanentShareLink(shareToken: string) {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/public/s/${shareToken}`;
  }

  return `/public/s/${shareToken}`;
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
