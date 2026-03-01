'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  listProductsResponseSchema,
  listSeriesResponseSchema,
  type Product,
  type Series
} from '@eggturtle/shared';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken, resolveAuthenticatedAssetUrl } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { NativeSelect } from '../../../../components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Filters = {
  code: string;
  search: string;
  seriesId: string;
  withImage: 'all' | 'yes' | 'no';
};

export default function BreedersListPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const searchParams = useSearchParams();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const filterQueryKey = searchParams.toString();
  const initialFilters = useMemo<Filters>(() => {
    const query = new URLSearchParams(filterQueryKey);

    return {
      seriesId: query.get('seriesId') ?? '',
      search: query.get('search') ?? '',
      code: query.get('code') ?? '',
      withImage: (query.get('withImage') as Filters['withImage']) ?? 'all'
    };
  }, [filterQueryKey]);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [seriesOptions, setSeriesOptions] = useState<Series[]>([]);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.withImage === 'yes') {
        return Boolean(item.coverImageUrl);
      }

      if (filters.withImage === 'no') {
        return !item.coverImageUrl;
      }

      return true;
    });
  }, [filters.withImage, items]);

  const loadSeriesOptions = useCallback(async () => {
    const response = await apiRequest('/series?page=1&pageSize=100', {
      responseSchema: listSeriesResponseSchema
    });

    setSeriesOptions(response.items);
  }, []);

  const loadProducts = useCallback(async (query: Filters) => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '60');

    if (query.seriesId) {
      params.set('seriesId', query.seriesId);
    }

    if (query.search) {
      params.set('search', query.search);
    }

    if (query.code) {
      params.set('code', query.code);
    }

    const response = await apiRequest(`/products?${params.toString()}`, {
      responseSchema: listProductsResponseSchema
    });

    setItems(response.products);
    setMeta({
      page: response.page,
      pageSize: response.pageSize,
      total: response.total,
      totalPages: response.totalPages
    });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

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

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        await Promise.all([loadSeriesOptions(), loadProducts(initialFilters)]);
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
  }, [initialFilters, loadProducts, loadSeriesOptions, router, tenantSlug]);

  async function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const query: Filters = {
        seriesId: filters.seriesId,
        search: filters.search.trim(),
        code: filters.code.trim(),
        withImage: filters.withImage
      };

      const nextUrl = new URLSearchParams();
      if (query.seriesId) {
        nextUrl.set('seriesId', query.seriesId);
      }
      if (query.search) {
        nextUrl.set('search', query.search);
      }
      if (query.code) {
        nextUrl.set('code', query.code);
      }
      if (query.withImage !== 'all') {
        nextUrl.set('withImage', query.withImage);
      }

      const suffix = nextUrl.toString();
      router.replace(suffix ? `/app/${tenantSlug}/breeders?${suffix}` : `/app/${tenantSlug}/breeders`);
      await loadProducts(query);
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleResetFilters() {
    const resetValue: Filters = {
      seriesId: '',
      search: '',
      code: '',
      withImage: 'all'
    };

    setFilters(resetValue);
    router.replace(`/app/${tenantSlug}/breeders`);

    try {
      await loadProducts(resetValue);
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-3xl">种龟管理</CardTitle>
            <CardDescription>每只龟都展示封面图，可直接进入详情或图片管理。</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/series`)}>
              系列管理
            </Button>
            <Button variant="primary" onClick={() => router.push(`/app/${tenantSlug}/products`)}>
              打开图片档案
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <SlidersHorizontal size={18} />
            筛选条件
          </CardTitle>
          <CardDescription>按系列、编码和关键词过滤，支持有图/无图快速筛查。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleApplyFilters}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div className="grid gap-2">
                <label htmlFor="series-filter">系列</label>
                <NativeSelect
                  id="series-filter"
                  value={filters.seriesId}
                  onChange={(event) => setFilters((current) => ({ ...current, seriesId: event.target.value }))}
                >
                  <option value="">全部系列</option>
                  {seriesOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.code} / {option.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="grid gap-2">
                <label htmlFor="search-filter">关键词</label>
                <Input
                  id="search-filter"
                  type="text"
                  placeholder="按编码或名称搜索"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="code-filter">精准编码</label>
                <Input
                  id="code-filter"
                  type="text"
                  placeholder="BRD-ALPHA-001"
                  value={filters.code}
                  onChange={(event) => setFilters((current) => ({ ...current, code: event.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="cover-filter">图片状态</label>
                <NativeSelect
                  id="cover-filter"
                  value={filters.withImage}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      withImage: event.target.value as Filters['withImage']
                    }))
                  }
                >
                  <option value="all">全部</option>
                  <option value="yes">仅有图片</option>
                  <option value="no">仅无图片</option>
                </NativeSelect>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={loading}>
                <Search size={16} />
                {loading ? '加载中...' : '应用筛选'}
              </Button>
              <Button type="button" variant="secondary" disabled={loading} onClick={() => void handleResetFilters()}>
                重置
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl">种龟列表</CardTitle>
            <CardDescription>
              共 {meta.total} 条，当前展示 {filteredItems.length} 条
            </CardDescription>
          </div>
          <Badge variant="accent">IMAGE READY</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-neutral-600">正在加载种龟数据...</p> : null}
          {!loading && filteredItems.length === 0 ? <p className="text-sm text-neutral-500">当前筛选条件下没有结果。</p> : null}

          {!loading && filteredItems.length > 0 ? (
            <>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>封面</TableHead>
                      <TableHead>编码</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>系列</TableHead>
                      <TableHead>性别</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <BreederImagePreview item={item} />
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-neutral-900">{item.code}</p>
                        </TableCell>
                        <TableCell>{item.name ?? '未命名种龟'}</TableCell>
                        <TableCell>{readSeriesCode(seriesOptions, item.seriesId)}</TableCell>
                        <TableCell>{formatSex(item.sex)}</TableCell>
                        <TableCell>
                          <Badge variant={item.inStock ? 'success' : 'default'}>{item.inStock ? '启用' : '停用'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/breeders/${item.id}`)}>
                              详情
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => router.push(`/app/${tenantSlug}/products/${item.id}`)}>
                              图片管理
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 lg:hidden">
                {filteredItems.map((item) => (
                  <article key={`${item.id}-mobile`} className="rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <BreederImagePreview item={item} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-neutral-900">{item.code}</p>
                          <Badge variant={item.inStock ? 'success' : 'default'}>{item.inStock ? '启用' : '停用'}</Badge>
                        </div>
                        <p className="truncate text-xs text-neutral-500">{item.name ?? '未命名种龟'}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {readSeriesCode(seriesOptions, item.seriesId)} · {formatSex(item.sex)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/breeders/${item.id}`)}>
                        查看详情
                        <ArrowRight size={14} />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => router.push(`/app/${tenantSlug}/products/${item.id}`)}>
                        图片管理
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}
    </main>
  );
}

function BreederImagePreview({ item }: { item: Product }) {
  if (!item.coverImageUrl) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-100 text-[11px] text-neutral-500">
        无图
      </div>
    );
  }

  return (
    <img
      src={resolveImageUrl(item.coverImageUrl)}
      alt={`${item.code} cover`}
      className="h-14 w-14 rounded-xl border border-neutral-200 object-cover"
    />
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

function readSeriesCode(options: Series[], seriesId: string | null | undefined) {
  if (!seriesId) {
    return '未关联';
  }

  const series = options.find((item) => item.id === seriesId);
  if (!series) {
    return '未关联';
  }

  return series.code;
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
