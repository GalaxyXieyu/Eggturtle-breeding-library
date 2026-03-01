'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  aiAssistantQuotaStatusResponseSchema,
  createShareRequestSchema,
  createShareResponseSchema,
  listProductsResponseSchema,
  listSeriesResponseSchema,
  meResponseSchema,
  meSubscriptionResponseSchema,
  type AiAssistantQuotaStatusResponse,
  type MeResponse,
  type Product,
  type TenantSubscription
} from '@eggturtle/shared';
import { listFeaturedProductsResponseSchema } from '@eggturtle/shared/featured';
import { Boxes, Image as ImageIcon, Layers, Star, Turtle, ArrowRight, Copy, Link2 } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken, resolveAuthenticatedAssetUrl } from '../../../lib/api-client';
import { switchTenantBySlug } from '../../../lib/tenant-session';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';

type DashboardData = {
  me: MeResponse | null;
  subscription: TenantSubscription | null;
  aiQuota: AiAssistantQuotaStatusResponse | null;
  breedersTotal: number;
  productsTotal: number;
  seriesTotal: number;
  activeSeriesTotal: number;
  featuredTotal: number;
  coverSampleTotal: number;
  coverSampleWithImage: number;
  recentBreeders: Product[];
  recentProducts: Product[];
};

type DashboardState = {
  loading: boolean;
  error: string | null;
  data: DashboardData | null;
};

const EMPTY_DASHBOARD: DashboardData = {
  me: null,
  subscription: null,
  aiQuota: null,
  breedersTotal: 0,
  productsTotal: 0,
  seriesTotal: 0,
  activeSeriesTotal: 0,
  featuredTotal: 0,
  coverSampleTotal: 0,
  coverSampleWithImage: 0,
  recentBreeders: [],
  recentProducts: []
};

export default function TenantAppPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    data: null
  });
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setState({ loading: false, error: '缺少 tenantSlug。', data: null });
      return;
    }

    let cancelled = false;
    setState({ loading: true, error: null, data: null });

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);

        const [me, subscription, products, series, featured] = await Promise.all([
          apiRequest('/me', { responseSchema: meResponseSchema }),
          apiRequest('/me/subscription', {
            responseSchema: meSubscriptionResponseSchema
          }),
          apiRequest('/products?page=1&pageSize=24&sortBy=updatedAt&sortDir=desc', {
            responseSchema: listProductsResponseSchema
          }),
          apiRequest('/series?page=1&pageSize=100', { responseSchema: listSeriesResponseSchema }),
          apiRequest('/featured-products', { responseSchema: listFeaturedProductsResponseSchema })
        ]);
        const aiQuota = await apiRequest('/ai-assistant/quota', {
          responseSchema: aiAssistantQuotaStatusResponseSchema
        }).catch(() => null);

        const nextData: DashboardData = {
          me,
          subscription: subscription.subscription,
          aiQuota,
          breedersTotal: products.total,
          productsTotal: products.total,
          seriesTotal: series.total,
          activeSeriesTotal: series.items.filter((item) => item.isActive).length,
          featuredTotal: featured.items.length,
          coverSampleTotal: products.products.length,
          coverSampleWithImage: products.products.filter((item) => Boolean(item.coverImageUrl)).length,
          recentBreeders: products.products.slice(0, 6),
          recentProducts: products.products.slice(0, 6)
        };

        if (!cancelled) {
          setState({ loading: false, error: null, data: nextData });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ loading: false, error: formatError(error), data: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, tenantSlug]);

  const data = state.data ?? EMPTY_DASHBOARD;
  const coverRatio = data.coverSampleTotal > 0 ? Math.round((data.coverSampleWithImage / data.coverSampleTotal) * 100) : 0;
  const tenantId = data.me?.tenantId ?? null;
  const autoRecordQuota = data.aiQuota?.highlights.autoRecord ?? null;
  const queryOnlyQuota = data.aiQuota?.highlights.queryOnly ?? null;
  const autoRecordTotal = autoRecordQuota ? autoRecordQuota.baseLimit + autoRecordQuota.topUpBalance : null;
  const queryOnlyTotal = queryOnlyQuota ? queryOnlyQuota.baseLimit + queryOnlyQuota.topUpBalance : null;

  async function handleGenerateShareLink() {
    if (!tenantId) {
      setShareError('当前会话没有 tenantId，无法生成分享链接。');
      return;
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

      setShareLink(response.share.entryUrl);
      setShareMessage('分享链接已生成，可直接复制给访客。');
    } catch (error) {
      setShareError(formatError(error));
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopyShareLink() {
    if (!shareLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setShareMessage('已复制分享链接。');
      setShareError(null);
    } catch (error) {
      setShareError(formatError(error));
    }
  }

  return (
    <main className="space-y-4 pb-8 sm:space-y-6">
      {state.loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white/90 p-8">
          <p className="text-sm text-neutral-600">正在加载租户核心指标...</p>
        </Card>
      ) : null}

      {state.error ? (
        <Card className="rounded-3xl border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-700">{state.error}</p>
        </Card>
      ) : null}

      {!state.loading && !state.error ? (
        <>
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(340px,1fr)] 2xl:grid-cols-[minmax(0,3.4fr)_minmax(360px,1fr)]">
            <Card className="tenant-card-lift relative overflow-hidden rounded-3xl border-neutral-200/90 bg-white p-6 transition-all">
              <div className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-[#FFD400]/20 blur-3xl" />
              <CardHeader className="relative z-10 p-0">
                <Badge variant="accent" className="w-fit">
                  BREEDING REPORT
                </Badge>
                <CardTitle className="mt-4 text-4xl text-neutral-900 sm:text-5xl">{tenantSlug}</CardTitle>
                <CardDescription className="text-neutral-600">
                  工作台已接入真实租户数据，你可以直接从这里进入核心链路。
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 mt-8 p-0">
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Total Pets</p>
                <p className="mt-3 text-6xl font-black leading-none text-neutral-900 sm:text-7xl">{data.breedersTotal}</p>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">产品档案</p>
                    <p className="mt-1 text-lg font-bold leading-none text-neutral-900">{data.productsTotal}</p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">系列数量</p>
                    <p className="mt-1 text-lg font-bold leading-none text-neutral-900">{data.seriesTotal}</p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">活动推荐</p>
                    <p className="mt-1 text-lg font-bold leading-none text-neutral-900">{data.featuredTotal}</p>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-500">封面覆盖</p>
                    <p className="mt-1 text-lg font-bold leading-none text-neutral-900">{coverRatio}%</p>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button variant="primary" onClick={() => router.push(`/app/${tenantSlug}/products`)}>
                    宠物管理
                    <ArrowRight size={16} />
                  </Button>
                  <Button variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/share-presentation`)}>
                    分享展示
                  </Button>
                  <Button variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/series`)}>
                    系列管理
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white p-6 transition-all">
              <CardHeader className="p-0">
                <CardTitle className="text-2xl">账户与套餐</CardTitle>
                <CardDescription>身份、套餐状态与公开分享入口</CardDescription>
              </CardHeader>
              <CardContent className="mt-5 space-y-3 p-0 text-sm text-neutral-700">
                <div className="space-y-1 rounded-2xl bg-neutral-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">User</p>
                  <p className="font-semibold text-neutral-900">{data.me?.user.name ?? data.me?.user.email ?? '-'}</p>
                </div>
                <div className="space-y-1 rounded-2xl bg-neutral-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Plan</p>
                  <p className="font-semibold text-neutral-900">
                    {data.subscription ? `${data.subscription.plan} · ${data.subscription.status}` : '-'}
                  </p>
                </div>
                <div className="space-y-3 rounded-2xl border-2 border-[#FFD400]/60 bg-[#FFF9D6] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">AI 次数剩余</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-neutral-200 bg-white p-3">
                      <p className="text-[11px] text-neutral-500">自动记录</p>
                      <p className="mt-1 text-3xl font-black leading-none text-neutral-900">
                        {autoRecordQuota ? autoRecordQuota.remaining : '-'}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        / {autoRecordTotal ?? '-'} 次
                        {autoRecordQuota && autoRecordQuota.topUpBalance > 0 ? `（含充值 ${autoRecordQuota.topUpBalance}）` : ''}
                      </p>
                    </div>
                    <div className="rounded-xl border border-neutral-200 bg-white p-3">
                      <p className="text-[11px] text-neutral-500">智能问数</p>
                      <p className="mt-1 text-3xl font-black leading-none text-neutral-900">
                        {queryOnlyQuota ? queryOnlyQuota.remaining : '-'}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        / {queryOnlyTotal ?? '-'} 次
                        {queryOnlyQuota && queryOnlyQuota.topUpBalance > 0 ? `（含充值 ${queryOnlyQuota.topUpBalance}）` : ''}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-neutral-700">达到上限后可单独充值，支持多次叠加。</p>
                </div>
                <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Public Share</p>
                  <p className="break-all text-xs text-neutral-700">{shareLink ?? '还未生成分享链接'}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" size="sm" disabled={shareLoading} onClick={() => void handleGenerateShareLink()}>
                      <Link2 size={14} />
                      {shareLoading ? '生成中...' : '生成分享链接'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!shareLink || shareLoading}
                      onClick={() => void handleCopyShareLink()}
                    >
                      <Copy size={14} />
                      复制
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => router.push(`/app/${tenantSlug}/account`)}>
                      个人设置
                    </Button>
                  </div>
                  {shareMessage ? <p className="text-xs font-medium text-emerald-700">{shareMessage}</p> : null}
                  {shareError ? <p className="text-xs font-medium text-red-700">{shareError}</p> : null}
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <MetricCard label="产品档案" value={data.productsTotal} hint="PRODUCTS" icon={<Boxes size={18} />} />
            <MetricCard label="系列数量" value={data.seriesTotal} hint={`ACTIVE ${data.activeSeriesTotal}`} icon={<Layers size={18} />} />
            <MetricCard label="活动推荐" value={data.featuredTotal} hint="FEATURED" icon={<Star size={18} />} />
            <MetricCard label="封面覆盖" value={`${coverRatio}%`} hint={`SAMPLE ${data.coverSampleTotal}`} icon={<ImageIcon size={18} />} />
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
              <CardHeader>
                <CardTitle className="text-3xl">最新宠物</CardTitle>
                <CardDescription>按创建时间最新 6 条</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentBreeders.length === 0 ? <p className="text-sm text-neutral-500">暂无种龟数据。</p> : null}
                {data.recentBreeders.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left transition-colors hover:bg-neutral-50"
                    onClick={() => router.push(`/app/${tenantSlug}/products/${item.id}`)}
                  >
                    <BreederPreviewImage url={item.coverImageUrl} code={item.code} className="h-14 w-14 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{item.code}</p>
                      <p className="truncate text-xs text-neutral-500">{item.name ?? '未命名种龟'}</p>
                    </div>
                    <Badge variant={item.inStock ? 'success' : 'default'}>{item.inStock ? '启用' : '停用'}</Badge>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
              <CardHeader>
                <CardTitle className="text-3xl">最近更新图片档案</CardTitle>
                <CardDescription>进入产品页可上传/调整主图</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentProducts.length === 0 ? <p className="text-sm text-neutral-500">暂无产品数据。</p> : null}
                {data.recentProducts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left transition-colors hover:bg-neutral-50"
                    onClick={() => router.push(`/app/${tenantSlug}/products/${item.id}`)}
                  >
                    <BreederPreviewImage url={item.coverImageUrl ?? null} code={item.code} className="h-14 w-14 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{item.code}</p>
                      <p className="truncate text-xs text-neutral-500">{item.description ?? '暂无描述'}</p>
                    </div>
                    <Turtle size={18} className="text-neutral-400" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </main>
  );
}

function MetricCard(props: { label: string; value: number | string; hint: string; icon: ReactNode }) {
  return (
    <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white p-4 transition-all sm:p-5">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">{props.hint}</p>
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#FFD400]/15 text-neutral-800">{props.icon}</span>
        </div>
      </CardHeader>
      <CardContent className="mt-6 p-0">
        <p className="text-4xl font-bold leading-none text-neutral-900 sm:text-5xl">{props.value}</p>
        <p className="mt-2 text-sm text-neutral-600">{props.label}</p>
      </CardContent>
    </Card>
  );
}

function BreederPreviewImage(props: { url: string | null | undefined; code: string; className?: string }) {
  if (!props.url) {
    return (
      <div className={`flex items-center justify-center bg-neutral-100 text-xs text-neutral-500 ${props.className ?? ''}`}>
        无图
      </div>
    );
  }

  return <img src={resolveImageUrl(props.url)} alt={`${props.code} 封面`} className={`object-cover ${props.className ?? ''}`} />;
}

function resolveImageUrl(value: string) {
  return resolveAuthenticatedAssetUrl(value);
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
