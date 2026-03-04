'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  getProductFamilyTreeResponseSchema,
  getProductResponseSchema,
  listProductEventsResponseSchema,
  listProductImagesResponseSchema,
  type Product,
  type ProductEvent,
  type ProductFamilyTree,
  type ProductImage
} from '@eggturtle/shared';
import { ArrowLeft, CalendarClock, Image as ImageIcon, Network, PencilRuler } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken, resolveAuthenticatedAssetUrl } from '../../../../../lib/api-client';
import { formatSex } from '../../../../../lib/pet-format';
import { switchTenantBySlug } from '../../../../../lib/tenant-session';
import { cn } from '../../../../../lib/utils';
import ProductDrawer from '../../../../../components/product-drawer';
import { Badge } from '../../../../../components/ui/badge';
import { Button } from '../../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../components/ui/card';

type DetailState = {
  breeder: Product | null;
  events: ProductEvent[];
  tree: ProductFamilyTree | null;
  images: ProductImage[];
};

type FamilyTreeNode = ProductFamilyTree['self'] | ProductFamilyTree['children'][number];

const EVENT_FILTER_OPTIONS = [
  { key: 'all' as const, title: '全部' },
  { key: 'mating' as const, title: '交配' },
  { key: 'egg' as const, title: '产蛋' },
  { key: 'change_mate' as const, title: '换公' }
];

export default function BreederDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; tenantSlug: string }>();
  const searchParams = useSearchParams();
  const breederId = useMemo(() => params.id ?? '', [params.id]);
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const fromProducts = searchParams.get('from') === 'products';
  const isDemoMode = searchParams.get('demo') === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'mating' | 'egg' | 'change_mate'>('all');
  const [eventExpanded, setEventExpanded] = useState(true);
  const [data, setData] = useState<DetailState>({
    breeder: null,
    events: [],
    tree: null,
    images: []
  });
  const currentBreeder = data.breeder;

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return data.events;
    return data.events.filter((e) => e.eventType === eventFilter);
  }, [data.events, eventFilter]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, ProductEvent[]>();
    for (const event of filteredEvents) {
      const year = formatEventYear(event.eventDate);
      const current = groups.get(year);
      if (current) {
        current.push(event);
      } else {
        groups.set(year, [event]);
      }
    }
    return Array.from(groups.entries()).map(([year, items]) => ({ year, items }));
  }, [filteredEvents]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug || !breederId) {
      setError('缺少租户或种龟 ID。');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);

        const [productResponse, eventsResponse, treeResponse] = await Promise.all([
          apiRequest(`/products/${breederId}`, {
            responseSchema: getProductResponseSchema
          }),
          apiRequest(`/products/${breederId}/events`, {
            responseSchema: listProductEventsResponseSchema
          }),
          apiRequest(`/products/${breederId}/family-tree`, {
            responseSchema: getProductFamilyTreeResponseSchema
          })
        ]);

        const imageResponse = await apiRequest(`/products/${productResponse.product.id}/images`, {
          responseSchema: listProductImagesResponseSchema
        });
        const images = imageResponse.images;

        if (!cancelled) {
          setData({
            breeder: productResponse.product,
            events: eventsResponse.events,
            tree: treeResponse.tree,
            images
          });
          setActiveImageId(images[0]?.id ?? null);
          setError(null);
          setLoading(false);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatError(requestError));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [breederId, router, tenantSlug]);

  const activeImage = data.images.find((image) => image.id === activeImageId) ?? data.images[0] ?? null;
  const listHref = useMemo(() => {
    const query = new URLSearchParams();
    if (isDemoMode) {
      query.set('demo', '1');
    }

    if (fromProducts) {
      query.set('view', 'preview');
    }

    const queryString = query.toString();
    if (fromProducts) {
      return queryString ? `/app/${tenantSlug}/products?${queryString}` : `/app/${tenantSlug}/products`;
    }

    return queryString ? `/app/${tenantSlug}/breeders?${queryString}` : `/app/${tenantSlug}/breeders`;
  }, [fromProducts, isDemoMode, tenantSlug]);

  const openBreederDetail = useMemo(() => {
    return (nextBreederId: string) => {
      const query = new URLSearchParams();
      if (fromProducts) {
        query.set('from', 'products');
      }
      if (isDemoMode) {
        query.set('demo', '1');
      }

      const queryString = query.toString();
      router.push(queryString ? `/app/${tenantSlug}/breeders/${nextBreederId}?${queryString}` : `/app/${tenantSlug}/breeders/${nextBreederId}`);
    };
  }, [fromProducts, isDemoMode, router, tenantSlug]);

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <Card className="tenant-card-lift overflow-hidden rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardContent className="grid gap-6 p-0 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="relative bg-neutral-100">
            <button
              type="button"
              onClick={() => router.push(listHref)}
              className="absolute left-3 top-3 z-10 inline-flex h-9 items-center gap-1 rounded-full border border-white/40 bg-black/55 px-3 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-black/65"
              aria-label="返回列表"
            >
              <ArrowLeft size={14} />
              返回
            </button>
            {activeImage ? (
              <img src={resolveImageUrl(activeImage.url)} alt={`${data.breeder?.code ?? 'breeder'} 图片`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center text-neutral-400">
                <ImageIcon size={42} />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4">
              <p className="text-sm font-semibold text-white">{currentBreeder?.code ?? '种龟详情'}</p>
              <p className="text-xs text-white/85">{currentBreeder?.name ?? '未命名种龟'}</p>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={currentBreeder?.inStock ? 'success' : 'default'}>
                {currentBreeder?.inStock ? '启用中' : '停用'}
              </Badge>
              <Badge variant="accent">{formatSex(currentBreeder?.sex, { unknownLabel: 'unknown' })}</Badge>
              <Badge variant="sky">{currentBreeder?.seriesId ?? '未关联系列'}</Badge>
            </div>
            <div>
              <CardTitle className="text-4xl text-neutral-900">{currentBreeder?.code ?? '种龟详情'}</CardTitle>
              <CardDescription className="mt-2 text-base text-neutral-600">{currentBreeder?.description ?? '暂无描述'}</CardDescription>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetaItem label="父本" value={currentBreeder?.sireCode ?? 'N/A'} />
              <MetaItem label="母本" value={currentBreeder?.damCode ?? 'N/A'} />
              <MetaItem label="配偶" value={currentBreeder?.mateCode ?? 'N/A'} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => router.push(listHref)}>
                返回列表
              </Button>
              {currentBreeder ? (
                <Button variant="primary" onClick={() => setIsEditDrawerOpen(true)}>
                  <PencilRuler size={16} />
                  编辑资料
                </Button>
              ) : null}
              {currentBreeder ? (
                <Button variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/products/${currentBreeder.id}`)}>
                  图片管理
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">正在加载种龟、事件和家族树数据...</p>
        </Card>
      ) : null}

      {!loading && data.images.length > 0 ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ImageIcon size={18} />
              图片预览
            </CardTitle>
            <CardDescription>点击缩略图即可切换大图，排序与主图请在产品图片管理页操作。</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
            {data.images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImageId(image.id)}
                className={`overflow-hidden rounded-2xl border transition-all ${
                  image.id === (activeImage?.id ?? '')
                    ? 'border-[#FFD400] shadow-[0_6px_20px_rgba(255,212,0,0.25)]'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <img src={resolveImageUrl(image.url)} alt="种龟缩略图" className="h-24 w-full object-cover" />
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!loading && data.tree ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Network size={18} />
              家族谱系
            </CardTitle>
            <CardDescription>{data.tree.limitations}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
              <div className="overflow-x-auto overflow-y-hidden pb-4">
                <div className="inline-flex gap-8 px-4 py-6">
                  <div className="flex flex-col gap-3">
                    <div className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">父本 / 母本</div>
                    <TreeCard title="父本" node={data.tree.sire} onOpen={openBreederDetail} />
                    <TreeCard title="母本" node={data.tree.dam} onOpen={openBreederDetail} />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="text-center text-xs font-medium text-amber-600 dark:text-amber-400">当前个体 / 配偶</div>
                    <TreeCard title="当前个体" node={data.tree.self} onOpen={openBreederDetail} highlight />
                    <TreeCard title="配偶" node={data.tree.mate} onOpen={openBreederDetail} />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">子代</div>
                    {data.tree.children.length === 0 ? (
                      <TreeCard title="子代" node={null} onOpen={openBreederDetail} />
                    ) : (
                      data.tree.children.map((child) => (
                        <TreeCard
                          key={child.id}
                          title={formatSex(child.sex, { unknownLabel: 'unknown' })}
                          node={child}
                          onOpen={openBreederDetail}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                <div className="rounded-t-lg bg-black/60 px-4 py-1.5 text-[11px] text-white backdrop-blur-sm">左右滑动查看完整谱系</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CalendarClock size={18} />
              种龟事件
            </CardTitle>
            <CardDescription>交配、产蛋、换公等记录，与分享页展示一致。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.events.length === 0 ? (
              <p className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-6 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-neutral-950/40 dark:text-neutral-400">
                暂无事件记录。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {EVENT_FILTER_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setEventFilter(item.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        eventFilter === item.key
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white/15 dark:bg-neutral-50 dark:text-neutral-950'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20'
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-900/75">
                  <div className="flex w-max flex-row items-center gap-2">
                    {filteredEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-2.5 shadow-sm dark:border-white/10 dark:bg-neutral-950/40"
                      >
                        <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
                        <span className="text-[10px] font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
                          {formatEventShortDate(event.eventDate)}
                        </span>
                        <span className="text-[10px] font-semibold leading-tight text-neutral-600 dark:text-neutral-300">
                          {eventTypeLabel(event.eventType)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
                  <div className="border-b bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-950/35">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">记录（已加载 {filteredEvents.length} 条）</div>
                      <button
                        type="button"
                        onClick={() => setEventExpanded((current) => !current)}
                        className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20"
                      >
                        {eventExpanded ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>
                  {eventExpanded ? (
                    filteredEvents.length === 0 ? (
                      <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">暂无记录</div>
                    ) : (
                      <div>
                        {groupedEvents.map((group) => (
                          <div key={group.year}>
                            <div className="border-b border-neutral-200/80 px-4 py-2 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-neutral-300">
                              {group.year}
                            </div>
                            <div className="divide-y dark:divide-white/10">
                              {group.items.map((event) => (
                                <div key={event.id} className="px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
                                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{eventTypeLabel(event.eventType)}</span>
                                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{formatEventShortDate(event.eventDate)}</span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{buildEventSummary(event)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}

      <ProductDrawer
        mode="edit"
        open={isEditDrawerOpen}
        product={currentBreeder}
        tenantSlug={tenantSlug}
        isDemoMode={isDemoMode}
        onClose={() => setIsEditDrawerOpen(false)}
        onSaved={(nextProduct) => {
          setData((current) => ({
            ...current,
            breeder: nextProduct
          }));
          setIsEditDrawerOpen(false);
        }}
      />
    </main>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function TreeCard(props: { title: string; node: FamilyTreeNode | null; onOpen: (id: string) => void; highlight?: boolean }) {
  const node = props.node;

  return (
    <div
      className={cn(
        'w-28 rounded-2xl border bg-white p-3 shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] dark:bg-neutral-900/70',
        props.highlight
          ? 'border-amber-300 ring-2 ring-amber-200/70 dark:border-amber-400/80 dark:ring-amber-400/20'
          : 'border-neutral-200/90 dark:border-white/10'
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 dark:text-neutral-400">{props.title}</p>
      {node ? (
        <div className="mt-2 space-y-1.5">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{node.code}</p>
          <p className="line-clamp-2 min-h-8 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">{node.name ?? '未命名种龟'}</p>
          <div className="pt-1">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 rounded-full border border-neutral-200 px-2.5 text-[11px] font-semibold dark:border-white/10 dark:bg-neutral-950/35 dark:text-neutral-100"
              onClick={() => props.onOpen(node.id)}
            >
              打开
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">未关联</p>
      )}
    </div>
  );
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

function eventTypeLabel(eventType: string) {
  if (eventType === 'mating') return '交配';
  if (eventType === 'egg') return '产蛋';
  if (eventType === 'change_mate') return '换公';
  return eventType;
}

function eventTypeIcon(eventType: string) {
  if (eventType === 'mating') return '🔞';
  if (eventType === 'egg') return '🥚';
  if (eventType === 'change_mate') return '🔁';
  return '•';
}

function formatEventShortDate(isoDate: string) {
  const d = new Date(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}.${day}`;
}

function formatEventYear(isoDate: string) {
  const d = new Date(isoDate);
  return String(d.getFullYear());
}

function buildEventSummary(event: ProductEvent) {
  if (event.eventType === 'mating') {
    return `公龟 ${event.maleCode || '-'}`;
  }
  if (event.eventType === 'egg') {
    return `数量 ${typeof event.eggCount === 'number' ? event.eggCount : '-'}`;
  }
  if (event.eventType === 'change_mate') {
    return `换公 ${(event.oldMateCode || '-') + ' → ' + (event.newMateCode || '-')}`;
  }
  return '-';
}
