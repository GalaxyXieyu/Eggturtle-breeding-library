'use client';

import { ShieldCheck, Stamp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GetProductCertificateEligibilityResponse, SaleBatch, SaleAllocation, SaleSubjectMedia, ProductCertificatePreview, ProductCertificate } from '@eggturtle/shared';
import { formatDateShort } from '@/components/certificate-studio/utils';
import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

interface PreviewStepProps {
  tenantSlug: string;
  certificateEligibility: GetProductCertificateEligibilityResponse | null;
  certificateRequirements: GetProductCertificateEligibilityResponse['requirements'] | undefined;
  selectedBatch: SaleBatch | null;
  selectedAllocation: SaleAllocation | null;
  selectedSubjectMedia: SaleSubjectMedia | null;
  certificatePreview: ProductCertificatePreview | null;
  certificates: ProductCertificate[];
  canPreviewCertificate: boolean;
  canConfirmCertificate: boolean;
  previewingCertificate: boolean;
  confirmingCertificate: boolean;
  onPreview: () => Promise<void>;
  onConfirm: () => Promise<void>;
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2 text-center font-semibold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 bg-white text-neutral-500'}`}>
      {label}: {ok ? '通过' : '未满足'}
    </div>
  );
}

export function PreviewStep({
  tenantSlug,
  certificateEligibility,
  certificateRequirements,
  selectedBatch,
  selectedAllocation,
  selectedSubjectMedia,
  certificatePreview,
  certificates,
  canPreviewCertificate,
  canConfirmCertificate,
  previewingCertificate,
  confirmingCertificate,
  onPreview,
  onConfirm
}: PreviewStepProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 04</p>
            <h3 className="mt-1 text-lg font-semibold text-neutral-900">出证预览</h3>
            <p className="mt-1 text-sm text-neutral-500">确认后会生成正式证书，可通过二维码公开验真。</p>
          </div>
          <ShieldCheck className="text-emerald-600" size={20} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-neutral-700 sm:grid-cols-3">
          <StatusPill label="父本编号" ok={Boolean(certificateRequirements?.hasSireCode)} />
          <StatusPill label="母本编号" ok={Boolean(certificateRequirements?.hasDamCode)} />
          <StatusPill label="祖代追溯" ok={Boolean(certificateRequirements?.hasParentGrandparentTrace)} />
        </div>
        {certificateEligibility && !certificateEligibility.eligible ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-6 text-amber-700">{certificateEligibility.reasons.join('；')}</div>
        ) : null}
        <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          <div className="flex items-center justify-between gap-3">
            <span>当前批次</span>
            <span className="font-semibold text-neutral-900">{selectedBatch?.batchNo ?? '待绑定'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>成交客户</span>
            <span className="font-semibold text-neutral-900">{selectedAllocation?.buyerName ?? '待登记'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>主体图</span>
            <span className="font-semibold text-neutral-900">{selectedSubjectMedia?.label ?? '待上传'}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!canPreviewCertificate || previewingCertificate} onClick={() => void onPreview()}>
            {previewingCertificate ? '生成预览中...' : '预览证书'}
          </Button>
          <Button variant="primary" disabled={!canConfirmCertificate || confirmingCertificate} onClick={() => void onConfirm()}>
            {confirmingCertificate ? '确认生成中...' : '生成正式证书'}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/app/${tenantSlug}/certificates`)}>
            <Stamp size={14} />
            打开证书中心
          </Button>
        </div>
        {certificatePreview ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 text-xs text-neutral-600">
              <span>{certificatePreview.certNo}</span>
              <span>验真 ID: {certificatePreview.verifyId}</span>
            </div>
            <img src={`data:${certificatePreview.mimeType};base64,${certificatePreview.imageBase64}`} alt="证书预览" className="w-full" />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm leading-6 text-neutral-500">
            先完成批次、客户分配与主体图选择，再生成正式证书预览。确认后二维码将指向公开验真页。
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">最近证书</h3>
            <p className="mt-1 text-sm text-neutral-500">可在证书中心统一作废、补发和追踪成交记录。</p>
          </div>
          <Badge className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">已出证 {certificates.length}</Badge>
        </div>
        {certificates.length > 0 ? (
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(138px,1fr))] gap-3">
            {certificates.slice(0, 6).map((certificate) => (
              <div key={certificate.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                <img src={resolveAuthenticatedAssetUrl(certificate.contentPath)} alt={certificate.certNo} className="h-24 w-full object-cover" />
                <div className="space-y-1 px-3 py-3">
                  <p className="truncate text-xs font-semibold text-neutral-900">{certificate.certNo}</p>
                  <p className="text-[11px] text-neutral-500">
                    版本 V{certificate.versionNo} · {formatDateShort(certificate.issuedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">暂无证书记录。</p>
        )}
      </div>
    </div>
  );
}
