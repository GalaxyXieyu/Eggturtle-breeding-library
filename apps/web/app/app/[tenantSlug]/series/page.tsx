'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  listSeriesResponseSchema,
  type ListSeriesQuery,
  type Series
} from '@eggturtle/shared';
import { ArrowUpRight, Layers3, ListFilter, RotateCcw, Search } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function SeriesListPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [series, setSeries] = useState<Series[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });
  const activeCount = series.filter((item) => item.isActive).length;
  const hasSearch = search.trim().length > 0;

  const loadSeries = useCallback(async (query: Pick<ListSeriesQuery, 'search'>) => {
    setLoading(true);

    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', '50');

    if (query.search) {
      params.set('search', query.search);
    }

    const path = `/series?${params.toString()}`;
    const response = await apiRequest(path, {
      responseSchema: listSeriesResponseSchema
    });

    setSeries(response.items);
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
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setError('Missing tenantSlug in route.');
      setLoading(false);
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        await loadSeries({ search: '' });
      } catch (requestError) {
        if (!isCancelled) {
          setError(formatError(requestError));
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [loadSeries, router, tenantSlug]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await loadSeries({ search: search.trim() || undefined });
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleResetSearch() {
    setSearch('');

    try {
      await loadSeries({ search: undefined });
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleRefresh() {
    try {
      await loadSeries({ search: search.trim() || undefined });
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  return (
    <main className="space-y-4 pb-8 sm:space-y-6">
      {error ? (
        <Card className="rounded-3xl border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}

      <Card className="tenant-card-lift relative overflow-hidden rounded-3xl border-neutral-200/90 bg-white transition-all">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#FFD400]/20 blur-3xl" />
        <CardHeader className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-3xl">
                <Layers3 size={24} />
                系列管理
              </CardTitle>
              <CardDescription className="mt-2">按系列编码或名称快速定位，直接跳转到宠物列表继续编辑。</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">TOTAL {meta.total}</Badge>
              <Badge variant="success">ACTIVE {activeCount}</Badge>
              <Badge variant="default">INACTIVE {Math.max(meta.total - activeCount, 0)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 pt-0">
          <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={handleSearch}>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input
                type="text"
                placeholder="按系列编码或名称搜索"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-2xl border-neutral-200 bg-white pl-10"
              />
            </div>
            <Button type="submit" variant="primary" className="h-11 rounded-2xl px-5" disabled={loading}>
              <ListFilter size={16} />
              {loading ? '加载中...' : '应用筛选'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-11 rounded-2xl px-5"
              disabled={loading && !hasSearch}
              onClick={() => {
                void handleResetSearch();
              }}
            >
              <RotateCcw size={16} />
              重置
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-600">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
              当前第 {meta.page}/{meta.totalPages} 页
            </span>
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">每页 {meta.pageSize} 条</span>
            {hasSearch ? <span className="rounded-full border border-[#FFD400]/40 bg-[#FFF9D8] px-3 py-1.5">关键词：{search.trim()}</span> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-3xl">系列列表</CardTitle>
              <CardDescription className="mt-1">共 {meta.total} 条记录，支持一键进入对应系列下的宠物管理。</CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl"
              disabled={loading}
              onClick={() => {
                void handleRefresh();
              }}
            >
              <RotateCcw size={14} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600">
              正在加载系列数据...
            </div>
          ) : null}

          {!loading && series.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center">
              <p className="text-sm font-medium text-neutral-700">暂无系列数据</p>
              <p className="mt-2 text-xs text-neutral-500">可先在宠物管理里创建数据，系统会自动关联系列信息。</p>
            </div>
          ) : null}

          {!loading && series.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-neutral-200/90">
              <Table className="bg-white">
                <TableHeader className="bg-neutral-50/90">
                  <TableRow>
                    <TableHead className="min-w-[140px]">编码</TableHead>
                    <TableHead className="min-w-[120px]">名称</TableHead>
                    <TableHead className="min-w-[320px]">描述</TableHead>
                    <TableHead className="w-[96px] text-center">排序</TableHead>
                    <TableHead className="w-[96px] text-center">状态</TableHead>
                    <TableHead className="w-[140px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.map((item) => (
                    <TableRow key={item.id} className="align-top">
                      <TableCell>
                        <p className="font-semibold text-neutral-900">{item.code}</p>
                        <p className="mt-1 max-w-[180px] truncate text-xs text-neutral-500">{item.id}</p>
                      </TableCell>
                      <TableCell className="font-medium text-neutral-800">{item.name || '-'}</TableCell>
                      <TableCell>
                        <p className="line-clamp-2 text-sm leading-relaxed text-neutral-600">{item.description || '暂无描述'}</p>
                      </TableCell>
                      <TableCell className="text-center text-sm font-semibold text-neutral-700">{item.sortOrder}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.isActive ? 'success' : 'default'}>{item.isActive ? '启用' : '停用'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => router.push(`/app/${tenantSlug}/products?seriesId=${item.id}`)}
                          >
                            查看宠物
                            <ArrowUpRight size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
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
