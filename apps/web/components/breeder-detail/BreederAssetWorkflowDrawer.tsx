'use client';

import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type {
  GetProductCertificateEligibilityResponse,
  ProductCertificate,
  ProductCertificatePreview,
  ProductCouplePhoto,
  ProductEvent,
  SaleAllocation,
  SaleBatch,
  SaleSubjectMedia
} from '@eggturtle/shared';
import { FileBadge2, HeartHandshake, Layers3, ShieldCheck, Workflow, X } from 'lucide-react';

import {
  AllocationStep,
  BatchStep,
  CertificateStudioCard,
  CouplePhotoSection,
  PreviewStep,
  SubjectMediaStep
} from '@/components/certificate-studio';
import { buildFilterPillClass } from '@/components/filter-pill';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';

type CertificateStudioState = {
  selectedEggEventId: string;
  selectedBatchId: string;
  selectedAllocationId: string;
  selectedSubjectMediaId: string;
  plannedQuantity: string;
  priceLow: string;
  priceHigh: string;
  batchNote: string;
  allocationQuantity: string;
  buyerName: string;
  buyerAccountId: string;
  buyerContact: string;
  unitPrice: string;
  channel: string;
  campaignId: string;
  allocationNote: string;
  soldAt: string;
  subjectLabel: string;
  subjectIsPrimary: boolean;
  subjectFile: File | null;
};

type WorkflowMode = 'certificate' | 'couple-photo';

type BreederAssetWorkflowDrawerProps = {
  tenantSlug: string;
  eggEvents: ProductEvent[];
  eggEventOptionLabels: Map<string, string>;
  certificateEligibility: GetProductCertificateEligibilityResponse | null;
  certificateRequirements: GetProductCertificateEligibilityResponse['requirements'] | undefined;
  saleBatches: SaleBatch[];
  selectedBatch: SaleBatch | null;
  selectedAllocation: SaleAllocation | null;
  selectedSubjectMedia: SaleSubjectMedia | null;
  certificates: ProductCertificate[];
  certificatePreview: ProductCertificatePreview | null;
  canPreviewCertificate: boolean;
  canConfirmCertificate: boolean;
  previewingCertificate: boolean;
  confirmingCertificate: boolean;
  creatingSaleBatch: boolean;
  creatingSaleAllocation: boolean;
  uploadingSubjectMedia: boolean;
  assetError: string | null;
  studio: CertificateStudioState;
  setStudio: Dispatch<SetStateAction<CertificateStudioState>>;
  isFemaleBreeder: boolean;
  currentCouplePhoto: ProductCouplePhoto | null;
  couplePhotoHistory: ProductCouplePhoto[];
  generatingCouplePhoto: boolean;
  onPreviewCertificate: () => Promise<void>;
  onConfirmCertificate: () => Promise<void>;
  onCreateBatch: () => Promise<void>;
  onCreateAllocation: () => Promise<void>;
  onUploadSubjectMedia: () => Promise<void>;
  onGenerateCouplePhoto: () => Promise<void>;
};

function QuickActionCard({
  icon,
  title,
  description,
  meta,
  actionLabel,
  onClick
}: {
  icon: ReactNode;
  title: string;
  description: string;
  meta: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 text-neutral-900">
          {icon}
        </div>
        <button type="button" className={buildFilterPillClass(false)} onClick={onClick}>
          {actionLabel}
        </button>
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
        <p className="text-sm leading-6 text-neutral-500">{description}</p>
      </div>
      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs font-medium text-neutral-600">
        {meta}
      </div>
    </div>
  );
}

export function BreederAssetWorkflowDrawer({
  tenantSlug,
  eggEvents,
  eggEventOptionLabels,
  certificateEligibility,
  certificateRequirements,
  saleBatches,
  selectedBatch,
  selectedAllocation,
  selectedSubjectMedia,
  certificates,
  certificatePreview,
  canPreviewCertificate,
  canConfirmCertificate,
  previewingCertificate,
  confirmingCertificate,
  creatingSaleBatch,
  creatingSaleAllocation,
  uploadingSubjectMedia,
  assetError,
  studio,
  setStudio,
  isFemaleBreeder,
  currentCouplePhoto,
  couplePhotoHistory,
  generatingCouplePhoto,
  onPreviewCertificate,
  onConfirmCertificate,
  onCreateBatch,
  onCreateAllocation,
  onUploadSubjectMedia,
  onGenerateCouplePhoto
}: BreederAssetWorkflowDrawerProps) {
  const [openMode, setOpenMode] = useState<WorkflowMode | null>(null);

  const certificateMeta = useMemo(() => {
    const remaining = certificateEligibility?.quota.remaining ?? 0;
    const limit = certificateEligibility?.quota.limit ?? 100;
    return `本月剩余 ${remaining} / ${limit}；已出证 ${certificates.length} 张。`;
  }, [certificateEligibility, certificates.length]);

  const coupleMeta = useMemo(() => {
    if (!isFemaleBreeder) {
      return '当前为公龟，仅展示生成能力占位与历史记录框架。';
    }

    return currentCouplePhoto
      ? `当前已有 1 张生效夫妻照，历史累计 ${couplePhotoHistory.length} 张。`
      : `当前暂无生效夫妻照，历史累计 ${couplePhotoHistory.length} 张。`;
  }, [couplePhotoHistory.length, currentCouplePhoto, isFemaleBreeder]);

  return (
    <>
      <div className="tenant-card-lift rounded-3xl border border-neutral-200/90 bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.08)] transition-all">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
              <Workflow size={14} />
              Asset Workflow
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">证书与夫妻照改为快捷工作流</h2>
              <p className="mt-1 text-sm text-neutral-500">
                详情页主内容回到事件与谱系，复杂生成动作放进抽屉中分步处理。
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD400]/50 bg-[#FFF6BF] px-3 py-1.5 text-xs font-semibold text-neutral-800">
            <Layers3 size={14} />
            轻量入口，保留完整流程骨架
          </div>
        </div>

        {assetError ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {assetError}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <QuickActionCard
            icon={<FileBadge2 size={18} />}
            title="生成证书"
            description="继续沿用批次、客户分配、主体图和预览出证四步，只是入口改成详情页快捷按钮。"
            meta={certificateMeta}
            actionLabel="打开证书抽屉"
            onClick={() => setOpenMode('certificate')}
          />
          <QuickActionCard
            icon={<HeartHandshake size={18} />}
            title="生成夫妻图"
            description="保留母龟专属生成逻辑与历史浏览，先用抽屉承接快捷工作流，避免挤占详情主体。"
            meta={coupleMeta}
            actionLabel="打开夫妻图抽屉"
            onClick={() => setOpenMode('couple-photo')}
          />
        </div>
      </div>

      {openMode ? (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/45 p-3 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={openMode === 'certificate' ? '证书工作流' : '夫妻图工作流'}
          onClick={() => setOpenMode(null)}
        >
          <section
            className="relative mx-auto flex h-[78svh] w-[min(96vw,78rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl sm:h-[88svh]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
                    {openMode === 'certificate' ? <ShieldCheck size={14} /> : <HeartHandshake size={14} />}
                    {openMode === 'certificate' ? 'Certificate Workflow' : 'Couple Photo Workflow'}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-neutral-900">
                    {openMode === 'certificate' ? '证书生成抽屉' : '夫妻图生成抽屉'}
                  </p>
                  <p className="text-xs text-neutral-500">租户 {tenantSlug} · 延续筛选面板与产品抽屉的交互语言</p>
                </div>
                <button
                  type="button"
                  className={modalCloseButtonClass}
                  onClick={() => setOpenMode(null)}
                  aria-label="关闭抽屉"
                >
                  <X size={17} strokeWidth={2.6} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {openMode === 'certificate' ? (
                <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                  <CertificateStudioCard
                    certificateEligibility={certificateEligibility}
                    selectedBatch={selectedBatch}
                    selectedSubjectMedia={selectedSubjectMedia}
                  />

                  <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-4">
                      <BatchStep
                        studio={studio}
                        setStudio={setStudio}
                        eggEvents={eggEvents}
                        eggEventOptionLabels={eggEventOptionLabels}
                        saleBatches={saleBatches}
                        selectedBatch={selectedBatch}
                        creatingSaleBatch={creatingSaleBatch}
                        onCreateBatch={onCreateBatch}
                      />

                      <AllocationStep
                        studio={studio}
                        setStudio={setStudio}
                        selectedBatch={selectedBatch}
                        selectedAllocation={selectedAllocation}
                        creatingSaleAllocation={creatingSaleAllocation}
                        onCreateAllocation={onCreateAllocation}
                      />

                      <SubjectMediaStep
                        studio={studio}
                        setStudio={setStudio}
                        selectedBatch={selectedBatch}
                        selectedSubjectMedia={selectedSubjectMedia}
                        uploadingSubjectMedia={uploadingSubjectMedia}
                        onUploadMedia={onUploadSubjectMedia}
                      />
                    </div>

                    <PreviewStep
                      tenantSlug={tenantSlug}
                      certificateEligibility={certificateEligibility}
                      certificateRequirements={certificateRequirements}
                      selectedBatch={selectedBatch}
                      selectedAllocation={selectedAllocation}
                      selectedSubjectMedia={selectedSubjectMedia}
                      certificatePreview={certificatePreview}
                      certificates={certificates}
                      canPreviewCertificate={canPreviewCertificate}
                      canConfirmCertificate={canConfirmCertificate}
                      previewingCertificate={previewingCertificate}
                      confirmingCertificate={confirmingCertificate}
                      onPreview={onPreviewCertificate}
                      onConfirm={onConfirmCertificate}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                  <div className="rounded-[28px] border border-neutral-900 bg-neutral-950 px-5 py-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/72">
                          <HeartHandshake size={14} />
                          Couple Photo Studio
                        </div>
                        <h3 className="text-2xl font-semibold leading-tight">
                          夫妻图保留为售种物料工具，不再占据详情页主体版面。
                        </h3>
                        <p className="text-sm leading-6 text-white/70">
                          这一版先落地生成入口、当前生效图和历史浏览；后续如需扩展模板选择、文案参数，可继续在此抽屉追加步骤。
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Current</p>
                          <p className="mt-2 text-lg font-semibold text-white">{currentCouplePhoto ? '已生成' : '暂无'}</p>
                          <p className="text-xs text-white/60">当前生效夫妻图</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">History</p>
                          <p className="mt-2 text-2xl font-semibold text-white">{couplePhotoHistory.length}</p>
                          <p className="text-xs text-white/60">历史生成记录</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Eligibility</p>
                          <p className="mt-2 text-lg font-semibold text-white">{isFemaleBreeder ? '可生成' : '仅母龟可生成'}</p>
                          <p className="text-xs text-white/60">沿用现有业务限制</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CouplePhotoSection
                    isFemaleBreeder={isFemaleBreeder}
                    currentCouplePhoto={currentCouplePhoto}
                    couplePhotoHistory={couplePhotoHistory}
                    generatingCouplePhoto={generatingCouplePhoto}
                    onGenerate={onGenerateCouplePhoto}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
