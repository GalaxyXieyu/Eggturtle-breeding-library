'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  const breederId = useMemo(() => params.id ?? '', [params.id]);
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [data, setData] = useState<DetailState>({
    breeder: null,
    events: [],
    tree: null,
    images: []
  });
  const currentBreeder = data.breeder;

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
              <Button variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/breeders`)}>
                返回列表
              </Button>
              {currentBreeder ? (
                <Button variant="primary" onClick={() => router.push(`/app/${tenantSlug}/products/${currentBreeder.id}`)}>
                  <PencilRuler size={16} />
                  管理图片
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
              家族关系
            </CardTitle>
            <CardDescription>{data.tree.limitations}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <TreeCard title="当前个体" node={data.tree.self} tenantSlug={tenantSlug} />
              <TreeCard title="父本" node={data.tree.sire} tenantSlug={tenantSlug} />
              <TreeCard title="母本" node={data.tree.dam} tenantSlug={tenantSlug} />
              <TreeCard title="配偶" node={data.tree.mate} tenantSlug={tenantSlug} />
            </div>

            <div className="rounded-2xl border border-neutral-200 p-4">
              <h3 className="mb-3 text-base font-semibold text-neutral-900">子代</h3>
              {data.tree.children.length === 0 ? <p className="text-sm text-neutral-500">未找到直系子代。</p> : null}
              {data.tree.children.length > 0 ? (
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
                          <Button size="sm" variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/breeders/${child.id}`)}>
                            打开
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CalendarClock size={18} />
              事件记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.events.length === 0 ? <p className="text-sm text-neutral-500">暂无事件记录。</p> : null}
            {data.events.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>事件类型</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.eventType}</TableCell>
                      <TableCell>{new Date(event.eventDate).toLocaleString('zh-CN')}</TableCell>
                      <TableCell>{event.note ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
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

function TreeCard(props: { title: string; node: FamilyTreeNode | null; tenantSlug: string }) {
  const router = useRouter();

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{props.title}</p>
      {props.node ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm font-semibold text-neutral-900">{props.node.code}</p>
          <p className="text-xs text-neutral-500">{props.node.name ?? '未命名种龟'}</p>
          <div className="pt-2">
            <Button size="sm" variant="secondary" onClick={() => router.push(`/app/${props.tenantSlug}/breeders/${props.node?.id}`)}>
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
