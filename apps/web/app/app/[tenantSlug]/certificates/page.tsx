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
import { ExternalLink, RefreshCcw, Search, ShieldCheck, Stamp } from 'lucide-react';

import { ApiError, apiRequest, resolveAuthenticatedAssetUrl } from '../../../../lib/api-client';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { NativeSelect } from '../../../../components/ui/native-select';

const STATUS_OPTIONS: Array<{ label: string; value: '' | ProductCertificateStatus }> = [
  { label: '全部状态', value: '' },
  { label: '已签发', value: 'ISSUED' },
  { label: '补发作废', value: 'VOID_SUPERSEDED' },
  { label: '手动作废', value: 'VOID_MANUAL' },
];

export default function CertificateCenterPage() {
  const params = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const tenantSlug = params.tenantSlug ?? '';

  const [items, setItems] = useState<ProductCertificateCenterItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'' | ProductCertificateStatus>('');
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

  const loadItems = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const query = new URLSearchParams();
      if (keyword.trim()) {
        query.set('q', keyword.trim());
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
  }, [keyword, status]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const issuedCount = useMemo(() => items.filter((item) => item.certificate.status === 'ISSUED').length, [items]);

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

  return (
    <main className="space-y-5 pb-10">
      <Card className="overflow-hidden rounded-[30px] border-neutral-200/90 bg-neutral-950 text-white shadow-[0_26px_70px_rgba(15,23,42,0.28)]">
        <CardContent className="grid gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(255,212,0,0.24),_transparent_42%),linear-gradient(120deg,_rgba(255,255,255,0.05),_transparent_48%)] p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-7">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
              <Stamp size={14} />
              Certificate Center
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">租户级证书中心</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                在这里统一查看已签发证书、执行补发重开、手动作废，并跳转公开验真页；母龟详情页负责生成，这里负责持续管理。
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <MetricCard label="已签发" value={String(issuedCount)} note="当前有效证书" />
            <MetricCard label="总记录" value={String(items.length)} note="包含历史版本" />
            <MetricCard label="公开验真" value="QR" note="一证一验真入口" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-neutral-200/90 bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ShieldCheck size={18} />
            管理面板
          </CardTitle>
          <CardDescription>支持关键词、状态筛选，并提供补发预览 / 补发确认 / 作废操作。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <Input
                className="pl-9"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索证书编号 / 验真 ID / 母龟编号 / 买家名"
              />
            </div>
            <NativeSelect value={status} onChange={(event) => setStatus(event.target.value as '' | ProductCertificateStatus)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
            <Button variant="secondary" onClick={() => void loadItems()} disabled={refreshing}>
              <RefreshCcw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? '刷新中...' : '刷新列表'}
            </Button>
          </div>

          {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}

          {previewImage ? (
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">补发预览：{previewImage.certNo}</p>
                  <p className="text-xs text-neutral-500">验真 ID：{previewImage.verifyId}</p>
                </div>
                <Button variant="ghost" onClick={() => setPreviewImage(null)}>关闭预览</Button>
              </div>
              <img
                src={`data:${previewImage.mimeType};base64,${previewImage.imageBase64}`}
                alt={previewImage.certNo}
                className="w-full"
              />
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-neutral-500">证书中心加载中...</p>
          ) : items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-10 text-center text-sm text-neutral-500">
              当前筛选条件下暂无证书记录。
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((item) => {
                const isBusy = busyId === item.certificate.id;
                const isIssued = item.certificate.status === 'ISSUED';
                return (
                  <div key={item.certificate.id} className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                    <div className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)]">
                      <div className="bg-neutral-100">
                        <img
                          src={resolveImage(item.certificate.contentPath)}
                          alt={item.certificate.certNo}
                          className="h-full min-h-[200px] w-full object-cover"
                        />
                      </div>
                      <div className="space-y-4 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{item.batchNo ?? 'NO-BATCH'}</p>
                            <h3 className="mt-1 text-lg font-semibold text-neutral-900">{item.certificate.certNo}</h3>
                            <p className="mt-1 text-sm text-neutral-500">
                              {item.femaleCode} · {item.productName ?? '未命名'} · V{item.certificate.versionNo}
                            </p>
                          </div>
                          <StatusBadge status={item.certificate.status} />
                        </div>

                        <div className="grid gap-2 text-sm text-neutral-600 sm:grid-cols-2">
                          <InfoLine label="买家" value={item.buyerName ?? '未登记'} />
                          <InfoLine label="渠道" value={item.channel ?? '未登记'} />
                          <InfoLine label="分配单" value={item.allocationNo ?? '未登记'} />
                          <InfoLine label="生蛋日期" value={item.eggEventDate ? formatDate(item.eggEventDate) : '未绑定'} />
                        </div>

                        {item.subjectContentPath ? (
                          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                            <img src={resolveImage(item.subjectContentPath)} alt={item.batchNo ?? 'subject'} className="h-28 w-full object-cover" />
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => router.push(`/app/${tenantSlug}/breeders/${item.certificate.productId}`)}>
                            回到母龟详情
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => window.open(`/public/certificates/verify/${item.certificate.verifyId}`, '_blank', 'noopener')}>
                            <ExternalLink size={14} />
                            公开验真
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => void handlePreviewReissue(item)} disabled={!isIssued || isBusy}>
                            {isBusy ? '处理中...' : '补发预览'}
                          </Button>
                          <Button variant="primary" size="sm" onClick={() => void handleConfirmReissue(item)} disabled={!isIssued || isBusy}>
                            {isBusy ? '处理中...' : '确认补发'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void handleVoid(item)} disabled={!isIssued || isBusy}>
                            手动作废
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="text-xs text-white/60">{note}</p>
    </div>
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">{label}</p>
      <p className="mt-1 font-semibold text-neutral-900">{value}</p>
    </div>
  );
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
