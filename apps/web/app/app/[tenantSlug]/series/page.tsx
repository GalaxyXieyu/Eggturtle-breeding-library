/* eslint-disable @next/next/no-img-element */
'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  listSeriesResponseSchema,
  seriesSchema,
  type ListSeriesQuery,
  type Series,
} from '@eggturtle/shared';
import {
  ArrowUpRight,
  ChevronLeft,
  Layers3,
  ListFilter,
  Pencil,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';

import {
  ApiError,
  apiRequest,
  getAccessToken,
  resolveAuthenticatedAssetUrl,
} from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';
import TenantFloatingShareButton from '../../../../components/tenant-floating-share-button';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import {
  FloatingActionButton,
  FloatingActionDock,
  modalCloseButtonClass,
} from '../../../../components/ui/floating-actions';
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

type SeriesViewMode = 'preview' | 'manage';

const seriesResponseParser = {
  parse(value: unknown): Series {
    if (value && typeof value === 'object' && 'series' in value) {
      return seriesSchema.parse((value as { series: unknown }).series);
    }

    return seriesSchema.parse(value);
  },
};

export default function SeriesListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const viewMode = useMemo<SeriesViewMode>(
    () => normalizeSeriesViewMode(searchParams.get('view')),
    [searchParams],
  );
  const isManageMode = viewMode === 'manage';

  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<SeriesEditorState | null>(null);
  const [meta, setMeta] = useState<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
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
      responseSchema: listSeriesResponseSchema,
    });

    setSeries(response.items as SeriesItem[]);
    setMeta({
      page: response.page,
      pageSize: response.pageSize,
      total: response.total,
      totalPages: response.totalPages,
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
      setIsFilterModalOpen(false);
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  async function handleResetSearch() {
    setSearch('');

    try {
      await loadSeries({ search: undefined });
      setIsFilterModalOpen(false);
    } catch (requestError) {
      setError(formatError(requestError));
      setLoading(false);
    }
  }

  function renderFilterForm(mode: 'desktop' | 'mobile') {
    if (mode === 'desktop') {
      return (
        <form
          className="hidden gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={handleSearch}
        >
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <Input
              type="text"
              placeholder="按系列编码或名称搜索"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 rounded-2xl border-neutral-200 bg-white pl-10"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            className="h-11 rounded-2xl px-5"
            disabled={loading}
          >
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
      );
    }

    return (
      <form className="grid gap-3" onSubmit={handleSearch}>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            type="text"
            placeholder="按系列编码或名称搜索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 rounded-2xl border-neutral-200 bg-white pl-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="submit"
            variant="primary"
            className="h-11 rounded-2xl px-4"
            disabled={loading}
          >
            <ListFilter size={16} />
            {loading ? '加载中...' : '应用筛选'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-2xl px-4"
            disabled={loading && !hasSearch}
            onClick={() => {
              void handleResetSearch();
            }}
          >
            <RotateCcw size={16} />
            重置
          </Button>
        </div>
      </form>
    );
  }

  function openEditor(item: SeriesItem) {
    setEditor({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      isActive: item.isActive,
      sortOrder: String(item.sortOrder),
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
      sortOrder: nextSortOrder,
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
            ...updated,
          };
        }),
      );
      setError(null);
      setEditor(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSaving(false);
    }
  }

  function closeEditor() {
    if (saving) {
      return;
    }

    setEditor(null);
  }

  return (
    <>
      <main className="space-y-4 pb-8 sm:space-y-6">
        {error ? (
          <Card className="rounded-3xl border-red-200 bg-red-50 p-5">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </Card>
        ) : null}

        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-3xl">
                  <Layers3 size={24} />
                  系列列表
                </CardTitle>
                <CardDescription className="mt-1">
                  共 {meta.total} 条记录，卡片右上角可快速编辑。
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {renderFilterForm('desktop')}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
                当前第 {meta.page}/{meta.totalPages} 页
              </span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
                每页 {meta.pageSize} 条
              </span>
              {hasSearch ? (
                <span className="rounded-full border border-[#FFD400]/40 bg-[#FFF9D8] px-3 py-1.5">
                  关键词：{search.trim()}
                </span>
              ) : null}
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-600">
                  正在加载系列数据...
                </div>
              ) : null}

              {!loading && series.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/80 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-neutral-700">暂无系列数据</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    可先在宠物管理里创建数据，系统会自动关联系列信息。
                  </p>
                </div>
              ) : null}

              {!loading && series.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {series.map((item) => (
                    <article
                      key={item.id}
                      className="group overflow-hidden rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white via-white to-neutral-50 shadow-[0_12px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-[#0f1623]"
                    >
                      <div className="relative">
                        <SeriesCover item={item} />
                        {isManageMode ? (
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
                        ) : null}
                      </div>
                      {isManageMode ? (
                        <button
                          type="button"
                          className="block w-full bg-white/95 p-4 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/70 dark:bg-[#0f1623] dark:hover:bg-[#141f32]"
                          onClick={() => openEditor(item)}
                        >
                          <SeriesCardMeta item={item} />
                        </button>
                      ) : (
                        <div className="bg-white/95 p-4 dark:bg-[#0f1623]">
                          <SeriesCardMeta item={item} />
                        </div>
                      )}
                      <div className="flex items-center justify-end border-t border-neutral-200/80 bg-white/92 px-4 py-3 dark:border-white/10 dark:bg-[#0d1420]">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 rounded-lg"
                          onClick={() =>
                            router.push(
                              `/app/${tenantSlug}/products?seriesId=${encodeURIComponent(item.id)}`,
                            )
                          }
                        >
                          {isManageMode ? '进入宠物' : '查看该系列宠物'}
                          <ArrowUpRight size={14} />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {isManageMode && !isFilterModalOpen && !editor ? (
          <FloatingActionDock className="lg:hidden">
            <FloatingActionButton
              aria-label="打开系列筛选弹窗"
              onClick={() => setIsFilterModalOpen(true)}
            >
              <Search size={18} />
            </FloatingActionButton>
            <TenantFloatingShareButton intent="series" inline className="h-11 w-11" />
          </FloatingActionDock>
        ) : null}

        {isFilterModalOpen && isManageMode ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 sm:items-center sm:justify-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="筛选系列"
            onClick={() => setIsFilterModalOpen(false)}
          >
            <Card
              className="mx-auto w-[min(92vw,38rem)] max-h-[86vh] overflow-y-auto rounded-3xl border-neutral-200 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <CardHeader className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/95 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">筛选系列</CardTitle>
                    <CardDescription>设置筛选后会立即刷新下方系列卡片列表。</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className={modalCloseButtonClass}
                    onClick={() => setIsFilterModalOpen(false)}
                    aria-label="关闭筛选"
                  >
                    <X size={17} strokeWidth={2.6} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">{renderFilterForm('mobile')}</CardContent>
            </Card>
          </div>
        ) : null}

        {editor && isManageMode ? (
          <div
            className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="编辑系列"
            onClick={closeEditor}
          >
            <section
              className="relative mx-auto flex h-[88svh] w-[min(92vw,42rem)] flex-col rounded-3xl border border-neutral-200 bg-white shadow-2xl sm:h-[92svh]"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    onClick={closeEditor}
                    aria-label="关闭编辑抽屉"
                    disabled={saving}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-neutral-900">编辑系列</p>
                    <p className="text-xs text-neutral-500">{editor.code}</p>
                  </div>
                  <div className="h-9 w-9" />
                </div>
              </header>

              <form
                id="series-editor-form"
                className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6"
                onSubmit={handleSaveEditor}
              >
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-neutral-700">名称</span>
                  <Input
                    value={editor.name}
                    onChange={(event) =>
                      setEditor((current) =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                    className="rounded-xl"
                    required
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-neutral-700">描述</span>
                  <Textarea
                    value={editor.description}
                    onChange={(event) =>
                      setEditor((current) =>
                        current ? { ...current, description: event.target.value } : current,
                      )
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
                      setEditor((current) =>
                        current ? { ...current, sortOrder: event.target.value } : current,
                      )
                    }
                    className="rounded-xl"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={editor.isActive}
                    onChange={(event) =>
                      setEditor((current) =>
                        current ? { ...current, isActive: event.target.checked } : current,
                      )
                    }
                    className="h-4 w-4 accent-neutral-900"
                  />
                  <span className="text-sm font-medium text-neutral-700">启用系列</span>
                </label>
              </form>

              <footer className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={closeEditor} disabled={saving}>
                    取消
                  </Button>
                  <Button
                    form="series-editor-form"
                    type="submit"
                    variant="primary"
                    disabled={saving}
                  >
                    {saving ? '保存中...' : '保存修改'}
                  </Button>
                </div>
              </footer>
            </section>
          </div>
        ) : null}
      </main>
      {isManageMode ? (
        <div className="hidden lg:block">
          <TenantFloatingShareButton intent="series" />
        </div>
      ) : null}
      {!isManageMode ? <TenantFloatingShareButton intent="series" /> : null}
    </>
  );
}

async function updateSeries(id: string, payload: SeriesUpdatePayload) {
  try {
    return await apiRequest(`/series/${id}`, {
      method: 'PATCH',
      body: payload,
      responseSchema: seriesResponseParser,
    });
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }

    return apiRequest(`/series/${id}`, {
      method: 'PUT',
      body: payload,
      responseSchema: seriesResponseParser,
    });
  }
}

function SeriesCover({ item }: { item: SeriesItem }) {
  const coverImageUrl = item.coverImageUrl
    ? resolveAuthenticatedAssetUrl(item.coverImageUrl)
    : null;

  if (!coverImageUrl) {
    return (
      <div className="relative h-40 w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200">
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
        <div className="absolute left-4 top-4 rounded-lg border border-white/80 bg-white/90 px-2.5 py-1 text-xs font-semibold text-neutral-700">
          {item.code}
        </div>
        <div className="absolute bottom-3 left-4 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">
          暂无封面
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-40 w-full">
      <img src={coverImageUrl} alt={`${item.code} cover`} className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
      <div className="absolute bottom-3 left-4 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white">
        系列封面
      </div>
    </div>
  );
}

function SeriesCardMeta({ item }: { item: SeriesItem }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
            {item.code}
          </p>
          <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
            {item.name || '未命名系列'}
          </p>
        </div>
        <Badge variant={item.isActive ? 'success' : 'default'}>
          {item.isActive ? '启用' : '停用'}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
        {item.description || '暂无描述'}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-300">
        <span>排序 #{item.sortOrder}</span>
        <span className="truncate">ID {item.id.slice(0, 8)}</span>
      </div>
    </>
  );
}

function normalizeSeriesViewMode(value: string | null): SeriesViewMode {
  if (value === 'preview') {
    return 'preview';
  }
  return 'manage';
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
