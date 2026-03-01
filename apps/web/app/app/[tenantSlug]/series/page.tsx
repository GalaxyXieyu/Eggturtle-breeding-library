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
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type SeriesListItem = Series & {
  coverImageUrl?: string | null;
};

type SeriesListResponse = {
  items: SeriesListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type SeriesEditFormState = {
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

const passthroughSchema = {
  parse(value: unknown) {
    return value;
  }
};

export default function SeriesListPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [series, setSeries] = useState<SeriesListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingSeries, setEditingSeries] = useState<SeriesListItem | null>(null);
  const [editForm, setEditForm] = useState<SeriesEditFormState | null>(null);
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

    const requestParams = new URLSearchParams();
    requestParams.set('page', '1');
    requestParams.set('pageSize', '50');

    if (query.search) {
      requestParams.set('search', query.search);
    }

    const path = `/series?${requestParams.toString()}`;
    const response = await apiRequest(path, {
      responseSchema: {
        parse(value: unknown) {
          return parseSeriesListResponse(value);
        }
      }
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

  useEffect(() => {
    if (!editingSeries) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        setEditingSeries(null);
        setEditForm(null);
        setSaveError(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editingSeries, saving]);

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

  function openEditor(item: SeriesListItem) {
    setEditingSeries(item);
    setEditForm({
      name: item.name,
      description: item.description ?? '',
      isActive: item.isActive,
      sortOrder: String(item.sortOrder)
    });
    setSaveError(null);
  }

  function closeEditor() {
    if (saving) {
      return;
    }

    setEditingSeries(null);
    setEditForm(null);
    setSaveError(null);
  }

  async function handleSaveSeries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingSeries || !editForm) {
      return;
    }

    const name = editForm.name.trim();

    if (!name) {
      setSaveError('系列名称不能为空。');
      return;
    }

    const sortOrder = Number(editForm.sortOrder);

    if (!Number.isInteger(sortOrder)) {
      setSaveError('排序必须是整数。');
      return;
    }

    const payload: SeriesUpdatePayload = {
      name,
      description: editForm.description.trim() ? editForm.description.trim() : null,
      isActive: editForm.isActive,
      sortOrder
    };

    setSaving(true);
    setSaveError(null);

    try {
      await saveSeriesChanges(editingSeries, payload);

      setSeries((current) =>
        current.map((item) =>
          item.id === editingSeries.id
            ? {
                ...item,
                ...payload
              }
            : item
        )
      );

      setEditingSeries(null);
      setEditForm(null);

      await loadSeries({ search: search.trim() || undefined });
    } catch (requestError) {
      setSaveError(formatError(requestError));
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
              <CardDescription className="mt-2">按系列编码或名称快速定位，点击卡片即可编辑系列信息。</CardDescription>
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
              <CardDescription className="mt-1">卡片化展示，移动端优先，点开卡片可直接编辑。</CardDescription>
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
              {series.map((item) => {
                const hasCover = Boolean(item.coverImageUrl);

                return (
                  <Card key={item.id} className="overflow-hidden border-neutral-200/90">
                    <button
                      type="button"
                      className="w-full cursor-pointer text-left transition hover:bg-neutral-50"
                      onClick={() => {
                        openEditor(item);
                      }}
                    >
                      <div
                        className="aspect-[4/3] w-full border-b border-neutral-200 bg-neutral-100 bg-cover bg-center"
                        style={hasCover ? { backgroundImage: `url(${item.coverImageUrl})` } : undefined}
                        aria-label={`${item.name}封面`}
                      >
                        {!hasCover ? (
                          <div className="flex h-full items-center justify-center text-sm font-medium text-neutral-400">暂无封面</div>
                        ) : null}
                      </div>

                      <div className="space-y-3 p-4">
                        <div className="space-y-1">
                          <p className="font-mono text-xs text-neutral-500">{item.code}</p>
                          <p className="line-clamp-1 text-base font-semibold text-neutral-900">{item.name || '-'}</p>
                        </div>
                        <Badge variant={item.isActive ? 'success' : 'default'}>{item.isActive ? '启用' : '停用'}</Badge>
                      </div>
                    </button>

                    <CardContent className="flex gap-2 p-4 pt-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          openEditor(item);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/app/${tenantSlug}/products?seriesId=${item.id}`)}
                      >
                        查看宠物
                        <ArrowUpRight size={14} />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {editingSeries && editForm ? (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => {
            closeEditor();
          }}
        >
          <section
            className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-neutral-200 bg-white p-4 shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[420px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l"
            role="dialog"
            aria-modal="true"
            aria-labelledby="series-editor-title"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">系列编辑</p>
              <h3 id="series-editor-title" className="text-lg font-semibold text-neutral-900">
                {editingSeries.code}
              </h3>
              <p className="text-xs text-neutral-500">保存后会直接更新当前租户的系列信息。</p>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSaveSeries}>
              <div className="space-y-2">
                <Label htmlFor="series-edit-name">名称</Label>
                <Input
                  id="series-edit-name"
                  value={editForm.name}
                  onChange={(event) => {
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            name: event.target.value
                          }
                        : current
                    );
                  }}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="series-edit-description">描述</Label>
                <Textarea
                  id="series-edit-description"
                  rows={3}
                  value={editForm.description}
                  onChange={(event) => {
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            description: event.target.value
                          }
                        : current
                    );
                  }}
                  className="min-h-[96px]"
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="series-edit-sort-order">排序</Label>
                <Input
                  id="series-edit-sort-order"
                  type="number"
                  step={1}
                  value={editForm.sortOrder}
                  onChange={(event) => {
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            sortOrder: event.target.value
                          }
                        : current
                    );
                  }}
                  disabled={saving}
                />
              </div>

              <label
                htmlFor="series-edit-active"
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700"
              >
                <input
                  id="series-edit-active"
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) => {
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            isActive: event.target.checked
                          }
                        : current
                    );
                  }}
                  className="h-4 w-4 rounded border-neutral-300 accent-[#FFD400]"
                  disabled={saving}
                />
                <span>{editForm.isActive ? '当前状态：启用' : '当前状态：停用'}</span>
              </label>

              {saveError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p> : null}

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeEditor} disabled={saving}>
                  取消
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

async function saveSeriesChanges(series: SeriesListItem, payload: SeriesUpdatePayload) {
  try {
    await apiRequest(`/series/${series.id}`, {
      method: 'PATCH',
      body: payload,
      responseSchema: passthroughSchema
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      await apiRequest(`/series/${series.id}`, {
        method: 'PUT',
        body: {
          code: series.code,
          ...payload
        },
        responseSchema: passthroughSchema
      });

      return;
    }

    throw error;
  }
}

function parseSeriesListResponse(value: unknown): SeriesListResponse {
  const parsed = listSeriesResponseSchema.parse(value);
  const rawItems =
    value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];

  return {
    ...parsed,
    items: parsed.items.map((item, index) => ({
      ...item,
      coverImageUrl: extractCoverImageUrl(rawItems[index])
    }))
  };
}

function extractCoverImageUrl(item: unknown) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const value = (item as { coverImageUrl?: unknown }).coverImageUrl;

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
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
