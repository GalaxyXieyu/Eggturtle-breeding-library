'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  listSeriesResponseSchema,
  seriesSchema,
  type ListSeriesQuery,
  type Series
} from '@eggturtle/shared';
import { ArrowUpRight, Layers3, ListFilter, Pencil, RotateCcw, Search, X } from 'lucide-react';

import { ApiError, apiRequest, getAccessToken, resolveAuthenticatedAssetUrl } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type SeriesItem = Series & {
  coverImageUrl?: string | null;
};

type SeriesEditorState = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: string;
};

type SeriesUpdatePayload = {
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
};

const seriesResponseParser = {
  parse(value: unknown): Series {
    if (value && typeof value === 'object' && 'series' in value) {
      return seriesSchema.parse((value as { series: unknown }).series);
    }

    return seriesSchema.parse(value);
  }
};

export default function SeriesListPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<SeriesEditorState | null>(null);
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

    setSeries(response.items as SeriesItem[]);
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

  function openEditor(item: SeriesItem) {
    setEditor({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      isActive: item.isActive,
      sortOrder: String(item.sortOrder)
    });
  }

  async function handleSaveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editor) {
      return;
    }

    const nextName = editor.name.trim();
    const nextSortOrder = Number(editor.sortOrder);

    if (!nextName) {
      setError('系列名称不能为空。');
      return;
    }

    if (!Number.isInteger(nextSortOrder)) {
      setError('排序必须是整数。');
      return;
    }

    const payload: SeriesUpdatePayload = {
      name: nextName,
      description: editor.description.trim() ? editor.description.trim() : null,
      isActive: editor.isActive,
      sortOrder: nextSortOrder
    };

    setSaving(true);

    try {
      const updated = await updateSeries(editor.id, payload);

      setSeries((current) =>
        current.map((item) => {
          if (item.id !== editor.id) {
            return item;
          }

          return {
            ...item,
            ...updated
          };
        })
      );
      setError(null);
      setEditor(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSaving(false);
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
              <CardDescription className="mt-2">按系列编码或名称快速定位，卡片点击后在抽屉中编辑。</CardDescription>
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
              <CardTitle className="text-3xl">系列卡片</CardTitle>
              <CardDescription className="mt-1">共 {meta.total} 条记录，卡片右上角可快速编辑。</CardDescription>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {series.map((item) => (
                <article
                  key={item.id}
                  className="group overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_12px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-neutral-900/85"
                >
                  <div className="relative">
                    <SeriesCover item={item} />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute right-3 top-3 h-8 w-8 rounded-full border border-white/50 bg-white/90"
                      onClick={() => openEditor(item)}
                    >
                      <Pencil size={14} />
                      <span className="sr-only">编辑 {item.code}</span>
                    </Button>
                  </div>
                  <button type="button" className="block w-full p-4 text-left" onClick={() => openEditor(item)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">{item.code}</p>
                        <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{item.name || '未命名系列'}</p>
                      </div>
                      <Badge variant={item.isActive ? 'success' : 'default'}>{item.isActive ? '启用' : '停用'}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{item.description || '暂无描述'}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                      <span>排序 #{item.sortOrder}</span>
                      <span className="truncate">ID {item.id.slice(0, 8)}</span>
                    </div>
                  </button>
                  <div className="flex items-center justify-end border-t border-neutral-100 px-4 py-3 dark:border-white/10">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 rounded-lg"
                      onClick={() => router.push(`/app/${tenantSlug}/products?seriesId=${item.id}`)}
                    >
                      进入宠物
                      <ArrowUpRight size={14} />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {editor ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!saving) {
                setEditor(null);
              }
            }}
            aria-label="关闭编辑面板"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md border-l border-neutral-200 bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">编辑系列</p>
                <h2 className="mt-1 text-xl font-semibold text-neutral-900">{editor.code}</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => {
                  if (!saving) {
                    setEditor(null);
                  }
                }}
              >
                <X size={16} />
                <span className="sr-only">关闭</span>
              </Button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSaveEditor}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">名称</span>
                <Input
                  value={editor.name}
                  onChange={(event) => setEditor((current) => (current ? { ...current, name: event.target.value } : current))}
                  className="rounded-xl"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">描述</span>
                <Textarea
                  value={editor.description}
                  onChange={(event) =>
                    setEditor((current) => (current ? { ...current, description: event.target.value } : current))
                  }
                  className="min-h-[100px] rounded-xl"
                  placeholder="补充系列描述（可选）"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-700">排序</span>
                <Input
                  type="number"
                  value={editor.sortOrder}
                  onChange={(event) =>
                    setEditor((current) => (current ? { ...current, sortOrder: event.target.value } : current))
                  }
                  className="rounded-xl"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={editor.isActive}
                  onChange={(event) =>
                    setEditor((current) => (current ? { ...current, isActive: event.target.checked } : current))
                  }
                  className="h-4 w-4 accent-neutral-900"
                />
                <span className="text-sm font-medium text-neutral-700">启用系列</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!saving) {
                      setEditor(null);
                    }
                  }}
                  disabled={saving}
                >
                  取消
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? '保存中...' : '保存修改'}
                </Button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

async function updateSeries(id: string, payload: SeriesUpdatePayload) {
  try {
    return await apiRequest(`/series/${id}`, {
      method: 'PATCH',
      body: payload,
      responseSchema: seriesResponseParser
    });
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }

    return apiRequest(`/series/${id}`, {
      method: 'PUT',
      body: payload,
      responseSchema: seriesResponseParser
    });
  }
}

function SeriesCover({ item }: { item: SeriesItem }) {
  const coverImageUrl = item.coverImageUrl ? resolveAuthenticatedAssetUrl(item.coverImageUrl) : null;

  if (!coverImageUrl) {
    return (
      <div className="relative h-40 w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200">
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
        <div className="absolute left-4 top-4 rounded-lg border border-white/80 bg-white/90 px-2.5 py-1 text-xs font-semibold text-neutral-700">
          {item.code}
        </div>
        <div className="absolute bottom-3 left-4 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">暂无封面</div>
      </div>
    );
  }

  return (
    <div className="relative h-40 w-full">
      <img src={coverImageUrl} alt={`${item.code} cover`} className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
      <div className="absolute bottom-3 left-4 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">系列封面</div>
    </div>
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
