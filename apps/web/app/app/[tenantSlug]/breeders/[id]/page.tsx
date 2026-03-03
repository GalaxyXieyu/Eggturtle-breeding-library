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
import { CalendarClock, Image as ImageIcon, Network, PencilRuler } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken, resolveAuthenticatedAssetUrl } from '../../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../../lib/tenant-session';
import { Badge } from '../../../../../components/ui/badge';
import { Button } from '../../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../../components/ui/table';

type DetailState = {
  breeder: Product | null;
  events: ProductEvent[];
  tree: ProductFamilyTree | null;
  images: ProductImage[];
};

type FamilyTreeNode = ProductFamilyTree['self'];

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
  const [eventFilter, setEventFilter] = useState<'all' | 'mating' | 'egg' | 'change_mate'>('all');
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
              <Badge variant="accent">{formatSex(currentBreeder?.sex)}</Badge>
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
                <Button variant="primary" onClick={() => router.push(`/app/${tenantSlug}/products/${currentBreeder.id}`)}>
                  <PencilRuler size={16} />
                  编辑资料
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
          <CardContent className="space-y-6">
            <div className="overflow-x-auto rounded-2xl border border-neutral-200/90 bg-neutral-50/50 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-6">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">父本 / 母本</p>
                  <div className="flex gap-3">
                    <TreeCard title="父本" node={data.tree.sire} onOpen={openBreederDetail} />
                    <TreeCard title="母本" node={data.tree.dam} onOpen={openBreederDetail} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">当前个体 / 配偶</p>
                  <div className="flex gap-3">
                    <TreeCard title="当前个体" node={data.tree.self} onOpen={openBreederDetail} />
                    <TreeCard title="配偶" node={data.tree.mate} onOpen={openBreederDetail} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">子代</h3>
              {data.tree.children.length === 0 ? (
                <p className="text-sm text-neutral-500">未找到直系子代。</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>编码</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>性别</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tree.children.map((child) => (
                      <TableRow key={child.id}>
                        <TableCell>{child.code}</TableCell>
                        <TableCell>{child.name ?? '未命名种龟'}</TableCell>
                        <TableCell>{formatSex(child.sex)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="secondary" onClick={() => openBreederDetail(child.id)}>
                            打开
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
              <p className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-6 text-center text-sm text-neutral-500">暂无事件记录。</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all' as const, title: '全部' },
                    { key: 'mating' as const, title: '交配' },
                    { key: 'egg' as const, title: '产蛋' },
                    { key: 'change_mate' as const, title: '换公' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setEventFilter(item.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        eventFilter === item.key
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-2xl border border-neutral-200/90 bg-neutral-50/50 p-3 shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
                  <div className="flex w-max flex-row items-center gap-2">
                    {filteredEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex w-[80px] shrink-0 flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-2.5 shadow-sm"
                      >
                        <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
                        <span className="text-[10px] font-semibold leading-tight text-neutral-900">
                          {formatEventShortDate(event.eventDate)}
                        </span>
                        <span className="text-[10px] font-semibold leading-tight text-neutral-600">
                          {eventTypeLabel(event.eventType)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white">
                  {filteredEvents.map((event) => (
                    <div key={event.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
                            <span className="text-sm font-semibold text-neutral-900">{eventTypeLabel(event.eventType)}</span>
                            <span className="text-xs font-medium text-neutral-500">
                              {new Date(event.eventDate).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                          {event.note ? (
                            <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-600">{event.note}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
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

function TreeCard(props: { title: string; node: FamilyTreeNode | null; onOpen: (id: string) => void }) {
  const node = props.node;

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{props.title}</p>
      {node ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm font-semibold text-neutral-900">{node.code}</p>
          <p className="text-xs text-neutral-500">{node.name ?? '未命名种龟'}</p>
          <div className="pt-2">
            <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => props.onOpen(node.id)}>
              打开
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">未关联</p>
      )}
    </div>
  );
}

function resolveImageUrl(value: string) {
  return resolveAuthenticatedAssetUrl(value);
}

function formatSex(value?: string | null) {
  if (value === 'male') {
    return '公';
  }

  if (value === 'female') {
    return '母';
  }

  return value ?? '未知';
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
