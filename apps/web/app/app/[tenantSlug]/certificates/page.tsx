'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  confirmProductCertificateGenerateResponseSchema,
  generateProductCertificatePreviewResponseSchema,
  listProductCertificateCenterResponseSchema,
  type ProductCertificateCenterItem,
  type ProductCertificateStatus,
} from '@eggturtle/shared';
import {
  ArrowUpRight,
  ExternalLink,
  Eye,
  FileSearch,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { AccountSectionNav } from '@/components/account-section-nav';
import { buildFilterPillClass } from '@/components/filter-pill';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiError, apiRequest, resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: Array<{
  label: string;
  value: '' | ProductCertificateStatus;
  note: string;
}> = [
  { label: '全部', value: '', note: '查看所有版本' },
  { label: '有效', value: 'ISSUED', note: '当前可验真' },
  { label: '补发替换', value: 'VOID_SUPERSEDED', note: '已被新版本接替' },
  { label: '手动作废', value: 'VOID_MANUAL', note: '人工失效归档' },
];

const SEARCH_DEBOUNCE_MS = 260;

export default function CertificateCenterPage() {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const tenantSlug = params.tenantSlug ?? '';

  const [items, setItems] = useState<ProductCertificateCenterItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'' | ProductCertificateStatus>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    certNo: string;
    verifyId: string;
    imageBase64: string;
    mimeType: string;
  } | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setKeyword(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const loadItems = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const query = new URLSearchParams();
        if (keyword) {
          query.set('q', keyword);
        }
        if (status) {
          query.set('status', status);
        }
        query.set('limit', '100');
        const search = query.toString();
        const response = await apiRequest(`/products/certificates/center${search ? `?${search}` : ''}`, {
          responseSchema: listProductCertificateCenterResponseSchema,
        });
        setItems(response.items);
        setError(null);
      } catch (requestError) {
        setError(formatError(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [keyword, status],
  );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const hasFilters = Boolean(keyword || status);
  const activeFilterCount = Number(Boolean(keyword)) + Number(Boolean(status));
  const selectedStatusMeta = useMemo(
    () => STATUS_OPTIONS.find((item) => item.value === status) ?? STATUS_OPTIONS[0],
    [status],
  );
  const resultHeadline = useMemo(() => {
    if (loading) {
      return '正在整理证书记录...';
    }

    if (keyword && status) {
      return `当前查看“${selectedStatusMeta.label}”中命中的 ${items.length} 条记录`;
    }

    if (keyword) {
      return `关键词“${keyword}”命中 ${items.length} 条记录`;
    }

    if (status) {
      return `${selectedStatusMeta.label}证书共 ${items.length} 条`;
    }

    return `证书中心共收纳 ${items.length} 条版本记录`;
  }, [items.length, keyword, loading, selectedStatusMeta.label, status]);

  const resultSubline = useMemo(() => {
    if (keyword) {
      return '支持按证书编号、验真 ID、母龟编号和买家昵称快速回看。';
    }

    return selectedStatusMeta.note;
  }, [keyword, selectedStatusMeta.note]);

  async function handlePreviewReissue(item: ProductCertificateCenterItem) {
    setBusyId(item.certificate.id);
    try {
      const response = await apiRequest(`/products/certificates/${item.certificate.id}/reissue/preview`, {
        method: 'POST',
        body: {},
        responseSchema: generateProductCertificatePreviewResponseSchema,
      });
      setPreviewImage({
        certNo: response.preview.certNo,
        verifyId: response.preview.verifyId,
        imageBase64: response.preview.imageBase64,
        mimeType: response.preview.mimeType,
      });
      setError(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmReissue(item: ProductCertificateCenterItem) {
    setBusyId(item.certificate.id);
    try {
      await apiRequest(`/products/certificates/${item.certificate.id}/reissue/confirm`, {
        method: 'POST',
        body: {},
        responseSchema: confirmProductCertificateGenerateResponseSchema,
      });
      setPreviewImage(null);
      await loadItems({ silent: true });
      setError(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setBusyId(null);
    }
  }

  async function handleVoid(item: ProductCertificateCenterItem) {
    setBusyId(item.certificate.id);
    try {
      await apiRequest(`/products/certificates/${item.certificate.id}/void`, {
        method: 'POST',
        body: {
          voidReason: '证书中心手动作废',
        },
        responseSchema: {
          parse(value) {
            return value as unknown;
          },
        },
      });
      await loadItems({ silent: true });
      setError(null);
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setBusyId(null);
    }
  }

  function clearFilters() {
    setSearchInput('');
    setKeyword('');
    setStatus('');
  }

  function openVerifyPage(verifyId: string) {
    const target = `/public/certificates/verify/${verifyId}`;
    const popup = window.open(target, '_blank', 'noopener');
    if (!popup) {
      window.location.href = target;
    }
  }

  function openCertificatePreview(contentPath: string) {
    const target = resolveImage(contentPath);
    const popup = window.open(target, '_blank', 'noopener');
    if (!popup) {
      window.location.href = target;
    }
  }

  return (
    <main className="space-y-4 pb-10 sm:space-y-5">
      <AccountSectionNav tenantSlug={tenantSlug} active="certificates" />

      <Card className="rounded-[28px] border-neutral-200/90 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
        <CardHeader className="space-y-3 pb-4 sm:space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl text-neutral-900">
                <ShieldCheck size={18} />
                证书中心
              </CardTitle>
              <CardDescription className="mt-1 hidden sm:block">
                在这里筛选、预览、补发、作废与回看证书版本。
              </CardDescription>
              <p className="mt-1 text-sm text-neutral-500 sm:hidden">先筛选，再预览或处理证书；首屏直接看列表，不再放大头图。</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 lg:hidden"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal size={14} />
              筛选{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
          </div>

          <div className="hidden rounded-2xl border border-neutral-200 bg-[linear-gradient(135deg,#fffdf4,#f7f4ec)] px-4 py-3 sm:block">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">View Summary</p>
                <p className="text-sm font-semibold text-neutral-900">{resultHeadline}</p>
                <p className="text-xs text-neutral-500">{loading ? '证书列表正在同步最新状态。' : resultSubline}</p>
              </div>
              <div className="inline-flex items-center rounded-full border border-[#FFD400]/45 bg-[#FFF5C4] px-3 py-1 text-xs font-semibold text-neutral-900">
                {hasFilters ? '已启用筛选' : '全部版本'}
              </div>
            </div>

            {hasFilters ? (
              <div className="mt-3 hidden flex-wrap gap-2 text-xs lg:flex">
                {keyword ? (
                  <button
                    type="button"
                    className="rounded-full border border-[#FFD400]/45 bg-[#FFF5C4] px-3 py-1.5 font-medium text-neutral-800"
                    onClick={() => {
                      setSearchInput('');
                      setKeyword('');
                    }}
                  >
                    关键词：{keyword} ×
                  </button>
                ) : null}
                {status ? (
                  <button
                    type="button"
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-medium text-neutral-700"
                    onClick={() => setStatus('')}
                  >
                    状态：{selectedStatusMeta.label} ×
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-3xl border border-neutral-200 bg-white/90 p-4 sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-700">快速筛选</p>
                <p className="text-xs leading-5 text-neutral-500">先点状态 pill 做粗筛，再点右上角筛选按钮补关键词。</p>
              </div>
              <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-semibold text-neutral-600">
                {activeFilterCount > 0 ? `已选 ${activeFilterCount} 项` : '全部状态'}
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {STATUS_OPTIONS.map((option) => {
                const selected = status === option.value;
                return (
                  <button
                    key={`mobile-${option.value || 'all'}`}
                    type="button"
                    className={buildFilterPillClass(selected, { className: 'shrink-0' })}
                    onClick={() => setStatus(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {hasFilters ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {keyword ? (
                  <button
                    type="button"
                    className="rounded-full border border-[#FFD400]/45 bg-[#FFF5C4] px-3 py-1.5 font-medium text-neutral-800"
                    onClick={() => {
                      setSearchInput('');
                      setKeyword('');
                    }}
                  >
                    关键词：{keyword} ×
                  </button>
                ) : null}
                {status ? (
                  <button
                    type="button"
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-medium text-neutral-700"
                    onClick={() => setStatus('')}
                  >
                    状态：{selectedStatusMeta.label} ×
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs leading-5 text-neutral-500">默认展示所有版本；如果只想处理发货中的证书，先点“有效”。</p>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <div className={cn('space-y-4', filtersOpen ? 'block' : 'hidden', 'lg:block')}>
            <div className="grid gap-3 rounded-3xl border border-neutral-200 bg-neutral-50/80 p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <Input
                      className="pl-9 pr-10"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="搜索证书编号 / 验真 ID / 母龟编号 / 买家名"
                    />
                    {searchInput ? (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700"
                        onClick={() => setSearchInput('')}
                        aria-label="清空搜索关键词"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-neutral-500">输入后会自动刷新列表，适合快速找某位买家或某张证书。</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {hasFilters ? (
                    <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                      清空筛选
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" size="sm" onClick={() => void loadItems()} disabled={refreshing}>
                    <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? '刷新中...' : '刷新列表'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-medium text-neutral-600">状态筛选</p>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => {
                    const selected = status === option.value;
                    return (
                      <button
                        key={option.value || 'all'}
                        type="button"
                        className={buildFilterPillClass(selected)}
                        onClick={() => setStatus(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-neutral-500">有效版本适合发货回看，补发与作废用于排查历史版本变化。</p>
              </div>
            </div>
          </div>

          {error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
          ) : null}

          {previewImage ? (
            <div className="overflow-hidden rounded-[28px] border border-amber-200 bg-[linear-gradient(135deg,#fffaf0,#fff)] shadow-[0_12px_28px_rgba(251,191,36,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">补发预览 · {previewImage.certNo}</p>
                  <p className="text-xs text-neutral-500">验真 ID：{previewImage.verifyId} · 确认补发后会生成新版证书</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPreviewImage(null)}>
                  关闭预览
                </Button>
              </div>
              <img
                src={`data:${previewImage.mimeType};base64,${previewImage.imageBase64}`}
                alt={previewImage.certNo}
                className="w-full"
              />
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[28px] border border-dashed border-neutral-200 bg-neutral-50 px-4 py-12 text-center text-sm text-neutral-500">
              证书中心加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-neutral-300 bg-[linear-gradient(180deg,#fcfcfb,#f7f5f1)] px-5 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm text-neutral-500">
                <FileSearch size={20} />
              </div>
              <p className="mt-4 text-base font-semibold text-neutral-900">
                {hasFilters ? '当前筛选下还没有命中的证书。' : '证书中心还没有记录。'}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                {hasFilters
                  ? '可以放宽关键词或切回“全部”状态，再看看历史版本和公开验真记录。'
                  : '先去母龟详情页生成第一张证书，这里就会自动接管后续管理。'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {hasFilters ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    清空筛选
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/app/${tenantSlug}/breeders`)}>
                    去母龟列表
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => void loadItems()}>
                  重新刷新
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => {
                const isBusy = busyId === item.certificate.id;
                const isIssued = item.certificate.status === 'ISSUED';
                const statusTone = getStatusTone(item.certificate.status);
                return (
                  <article
                    key={item.certificate.id}
                    className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]"
                  >
                    <button
                      type="button"
                      className="relative block w-full overflow-hidden border-b border-neutral-200 bg-neutral-100 text-left"
                      onClick={() => openCertificatePreview(item.certificate.contentPath)}
                      aria-label={`预览 ${item.certificate.certNo}`}
                    >
                      <img
                        src={resolveImage(item.certificate.contentPath)}
                        alt={item.certificate.certNo}
                        className="aspect-[5/4] w-full object-cover transition-transform duration-300 hover:scale-[1.01] sm:aspect-[4/3]"
                      />
                      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-[linear-gradient(180deg,rgba(17,24,39,0.58),rgba(17,24,39,0))] p-4">
                        <div className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                          {item.batchNo ?? 'NO-BATCH'}
                        </div>
                        <StatusBadge status={item.certificate.status} />
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(17,24,39,0),rgba(17,24,39,0.78))] px-4 py-3 text-white">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">Verify ID</p>
                        <p className="mt-1 text-sm font-semibold">{compactVerifyId(item.certificate.verifyId)}</p>
                      </div>
                    </button>

                    <div className="space-y-4 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold text-neutral-900">{item.certificate.certNo}</h3>
                          <p className="mt-1 text-sm text-neutral-500">
                            {item.femaleCode} · {item.productName ?? '未命名'} · V{item.certificate.versionNo}
                          </p>
                        </div>
                        <div className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusTone)}>
                          {getStatusHint(item.certificate.status)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 text-[11px] text-neutral-700">
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1">买家 {item.buyerName ?? '未登记'}</span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1">渠道 {item.channel ?? '未登记'}</span>
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1">生蛋 {item.eggEventDate ? formatDate(item.eggEventDate) : '未绑定'}</span>
                      </div>

                      <div className="rounded-2xl bg-neutral-100/80 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">证书摘要</p>
                        <p className="mt-1 truncate text-sm font-medium text-neutral-800">
                          批次 {item.batchNo ?? '未登记'} · 分配 {item.allocationNo ?? '未登记'}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-neutral-500">
                          验真 ID {compactVerifyId(item.certificate.verifyId)} · {isIssued ? '当前版本可直接公开验真' : '历史版本仅保留回看与追踪'}
                        </p>
                      </div>

                      {item.subjectContentPath ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-2.5">
                          <img
                            src={resolveImage(item.subjectContentPath)}
                            alt={item.batchNo ?? 'subject'}
                            className="h-16 w-16 rounded-xl object-cover"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-neutral-800">成交主体图</p>
                            <p className="mt-1 text-xs leading-5 text-neutral-500">用于回看成交实拍，主视觉交给证书本身。</p>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-full px-4 text-xs"
                          onClick={() => openCertificatePreview(item.certificate.contentPath)}
                        >
                          <Eye size={14} />
                          预览证书
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-full px-4 text-xs"
                          onClick={() => openVerifyPage(item.certificate.verifyId)}
                        >
                          <ExternalLink size={14} />
                          公开验真
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-9 rounded-full px-4 text-xs"
                          onClick={() => router.push(`/app/${tenantSlug}/breeders/${item.certificate.productId}`)}
                        >
                          <ArrowUpRight size={14} />
                          母龟详情
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-9 rounded-full px-4 text-xs"
                          onClick={() => void handlePreviewReissue(item)}
                          disabled={!isIssued || isBusy}
                        >
                          {isBusy ? '处理中...' : '补发预览'}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-9 rounded-full px-4 text-xs"
                          onClick={() => void handleConfirmReissue(item)}
                          disabled={!isIssued || isBusy}
                        >
                          {isBusy ? '处理中...' : '确认补发'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-full px-4 text-xs"
                          onClick={() => void handleVoid(item)}
                          disabled={!isIssued || isBusy}
                        >
                          手动作废
                        </Button>
                      </div>

                      {!isIssued ? (
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-500">
                          当前版本已归档，仅保留回看、验真与版本追踪能力；如需重新发证，请操作最新有效版本。
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function StatusBadge({ status }: { status: ProductCertificateStatus }) {
  if (status === 'ISSUED') {
    return <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">有效</Badge>;
  }

  if (status === 'VOID_SUPERSEDED') {
    return <Badge className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">补发已替换</Badge>;
  }

  return <Badge className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">手动作废</Badge>;
}

function getStatusTone(status: ProductCertificateStatus) {
  if (status === 'ISSUED') {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (status === 'VOID_SUPERSEDED') {
    return 'bg-amber-50 text-amber-700';
  }

  return 'bg-neutral-100 text-neutral-600';
}

function getStatusHint(status: ProductCertificateStatus) {
  if (status === 'ISSUED') {
    return '当前有效版本';
  }

  if (status === 'VOID_SUPERSEDED') {
    return '已被补发版本替换';
  }

  return '人工作废留档';
}

function compactVerifyId(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 8)} · ${value.slice(-4)}`;
}

function resolveImage(value: string) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
