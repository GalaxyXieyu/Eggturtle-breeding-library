import { verifyProductCertificateResponseSchema } from '@eggturtle/shared';
import { Gem, ShieldCheck, Sparkles, Stamp } from 'lucide-react';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:30011';

type PageProps = {
  params: Promise<{
    verifyId: string;
  }>;
};

export default async function PublicCertificateVerifyPage({ params }: PageProps) {
  const { verifyId } = await params;
  const result = await fetchCertificate(verifyId);

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/5 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.4)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Certificate Verify</p>
          <h1 className="mt-4 text-3xl font-semibold">未能获取证书信息</h1>
          <p className="mt-3 text-sm leading-7 text-white/70">{result.message}</p>
        </div>
      </main>
    );
  }

  const certificate = result.data.certificate;
  const lineage = asRecord(certificate.lineageSnapshot);
  const female = asRecord(lineage.female);
  const male = asRecord(lineage.male);
  const grandparents = asRecord(lineage.grandparents);

  return (
    <main className="min-h-screen bg-[#0b1017] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,212,0,0.2),_transparent_35%),linear-gradient(135deg,_rgba(255,255,255,0.05),_transparent_50%),#0f1722] shadow-[0_30px_100px_rgba(15,23,42,0.45)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                <Stamp size={14} />
                Verified Certificate
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{certificate.certNo}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/72">
                  此页面用于公开验真与成交凭证展示。证书绑定生蛋事件、销售批次、买家分配与成交主体图，并保留父本锁定快照。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="状态" value={translateStatus(certificate.status)} note={`版本 V${certificate.versionNo}`} />
                <MetricCard label="卖家" value={certificate.tenantName} note="商家实名签发" />
                <MetricCard label="验真 ID" value={certificate.verifyId.slice(0, 8)} note="扫码可回访本页" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <InfoPanel title="种龟信息" value={`${certificate.productCode}${certificate.productName ? ` · ${certificate.productName}` : ''}`} note={`签发日期 ${formatDateTime(certificate.issuedAt)}`} />
              <InfoPanel title="销售批次" value={certificate.batch?.batchNo ?? '未绑定'} note={certificate.batch ? `计划 ${certificate.batch.plannedQuantity} / 已售 ${certificate.batch.soldQuantity}` : '无批次信息'} />
              <InfoPanel title="买家信息" value={certificate.allocation?.buyerName ?? '未披露'} note={certificate.allocation?.channel ? `渠道：${certificate.allocation.channel}` : '未登记渠道'} />
              <InfoPanel title="商家水印" value="仅商家水印" note="用于提升证书辨识度与收藏感" />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white shadow-[0_18px_60px_rgba(255,255,255,0.08)]">
            <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-5 py-4 text-neutral-900">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-500">Official Preview</p>
                <h2 className="mt-1 text-lg font-semibold">证书正文</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck size={14} />
                已验真
              </div>
            </div>
            <img src={certificate.contentPath} alt={certificate.certNo} className="w-full bg-[#f4eee2] object-cover" />
          </div>

          <div className="space-y-5">
            <section className="rounded-[32px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
              <div className="flex items-center gap-2 text-white">
                <Gem size={18} className="text-[#FFD400]" />
                <h2 className="text-xl font-semibold">血统快照</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailTile label="母龟编号" value={valueOrFallback(female.code)} />
                <DetailTile label="母龟名称" value={valueOrFallback(female.name)} />
                <DetailTile label="父本编号" value={valueOrFallback(male.code)} />
                <DetailTile label="系列" value={valueOrFallback(female.seriesName)} />
                <DetailTile label="父祖" value={valueOrFallback(grandparents.sireSireCode)} />
                <DetailTile label="父母" value={valueOrFallback(grandparents.sireDamCode)} />
                <DetailTile label="母祖" value={valueOrFallback(grandparents.damSireCode)} />
                <DetailTile label="母母" value={valueOrFallback(grandparents.damDamCode)} />
              </div>
            </section>

            <section className="rounded-[32px] border border-white/10 bg-white/5 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
              <div className="flex items-center gap-2 text-white">
                <Sparkles size={18} className="text-[#FFD400]" />
                <h2 className="text-xl font-semibold">成交摘要</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailTile label="销售批次" value={certificate.batch?.batchNo ?? '未绑定'} />
                <DetailTile label="生蛋日期" value={certificate.batch ? formatDate(certificate.batch.eventDateSnapshot) : '未绑定'} />
                <DetailTile label="买家" value={certificate.allocation?.buyerName ?? '未披露'} />
                <DetailTile label="买家账号" value={certificate.allocation?.buyerAccountId ?? '未披露'} />
                <DetailTile label="成交数量" value={certificate.allocation ? `${certificate.allocation.quantity} 只` : '未登记'} />
                <DetailTile label="成交单价" value={formatPrice(certificate.allocation?.unitPrice)} />
                <DetailTile label="渠道" value={certificate.allocation?.channel ?? '未登记'} />
                <DetailTile label="活动标识" value={certificate.allocation?.campaignId ?? '未登记'} />
              </div>
            </section>

            {certificate.subjectContentPath ? (
              <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
                <div className="flex items-center justify-between gap-3 px-5 py-4 text-white">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45">Subject Portrait</p>
                    <h2 className="mt-1 text-xl font-semibold">成交主体图</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">批次实拍</div>
                </div>
                <img src={certificate.subjectContentPath} alt={`${certificate.certNo}-subject`} className="h-72 w-full object-cover" />
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

async function fetchCertificate(verifyId: string) {
  const apiBaseUrl = process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const url = new URL(`/public/certificates/verify/${verifyId}`, apiBaseUrl);
  const response = await fetch(url.toString(), {
    cache: 'no-store',
  });
  const payload = await safeJson(response);

  if (!response.ok) {
    return {
      ok: false as const,
      message: pickErrorMessage(payload, response.status),
    };
  }

  const parsed = verifyProductCertificateResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: '证书数据结构异常。',
    };
  }

  return {
    ok: true as const,
    data: parsed.data,
  };
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
      <p className="text-xs text-white/60">{note}</p>
    </div>
  );
}

function InfoPanel({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
      <p className="text-xs text-white/60">{note}</p>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-white">{value}</p>
    </div>
  );
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      message: text,
    };
  }
}

function pickErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }

  if (status === 404) {
    return '未找到对应的证书验真记录。';
  }

  return `请求失败，状态码 ${status}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function valueOrFallback(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : '未登记';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '未登记';
  }

  return `¥${value.toFixed(2)}`;
}

function translateStatus(status: string) {
  if (status === 'ISSUED') {
    return '有效';
  }
  if (status === 'VOID_SUPERSEDED') {
    return '补发替换';
  }
  if (status === 'VOID_MANUAL') {
    return '手动作废';
  }
  return status;
}
