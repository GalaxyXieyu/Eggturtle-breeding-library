'use client';

import { Fragment, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  GetProductCertificateEligibilityResponse,
  ProductCertificate,
  ProductCertificatePreview,
  ProductEvent,
  SaleAllocation,
  SaleBatch,
  SaleSubjectMedia,
} from '@eggturtle/shared';
import { Share2, Sparkles, Workflow, X } from 'lucide-react';

import {
  AllocationStep,
  BatchStep,
  PreviewStep,
  type CertificateStudioStep,
} from '@/components/certificate-studio';
import { buildFilterPillClass } from '@/components/filter-pill';
import TenantShareDialogTrigger from '@/components/tenant-share-dialog-trigger';
import {
  FloatingActionButton,
  FloatingActionDock,
  modalCloseButtonClass,
} from '@/components/ui/floating-actions';

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

export type DrawerSection = 'certificate' | 'share';
export type DrawerMode = 'quick' | 'direct';

type BreederAssetWorkflowDrawerProps = {
  breederId: string;
  breederName: string;
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
  uploadingSubjectMedia: boolean;
  assetError: string | null;
  studio: CertificateStudioState;
  setStudio: Dispatch<SetStateAction<CertificateStudioState>>;
  onPreviewCertificate: () => Promise<void>;
  onConfirmCertificate: () => Promise<void>;
  onUploadSubjectMedia: () => Promise<void>;
  isOpen: boolean;
  activeSection: DrawerSection;
  mode?: DrawerMode;
  onOpenChange: (open: boolean) => void;
  onSectionChange: (section: DrawerSection) => void;
};

export function BreederAssetWorkflowDrawer({
  breederId,
  breederName,
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
  uploadingSubjectMedia,
  assetError,
  studio,
  setStudio,
  onPreviewCertificate,
  onConfirmCertificate,
  onUploadSubjectMedia,
  isOpen,
  activeSection,
  mode = 'quick',
  onOpenChange,
  onSectionChange,
}: BreederAssetWorkflowDrawerProps) {
  const [activeCertificateStep, setActiveCertificateStep] =
    useState<CertificateStudioStep>('batch');

  const certificateMeta = useMemo(() => {
    const remaining = certificateEligibility?.quota.remaining ?? 0;
    const limit = certificateEligibility?.quota.limit ?? 100;
    return `本月剩余 ${remaining} / ${limit}；已出证 ${certificates.length} 张。`;
  }, [certificateEligibility, certificates.length]);

  const certificateStatus = useMemo(() => {
    if (!certificateEligibility) {
      return '待检查';
    }

    return certificateEligibility.eligible ? '可出证' : '待补齐';
  }, [certificateEligibility]);
  const shareIntent = useMemo(() => ({ productId: breederId }), [breederId]);

  useEffect(() => {
    if (activeSection !== 'certificate') {
      return;
    }

    if (certificatePreview) {
      setActiveCertificateStep('preview');
      return;
    }

    if (studio.selectedEggEventId && studio.selectedSubjectMediaId) {
      setActiveCertificateStep('allocation');
      return;
    }

    setActiveCertificateStep('batch');
  }, [activeSection, certificatePreview, studio.selectedEggEventId, studio.selectedSubjectMediaId]);

  const isDirectMode = mode === 'direct';

  const drawerTitle = isDirectMode
    ? activeSection === 'certificate'
      ? `${breederName || '当前种龟'} 的证书流程`
      : `${breederName || '当前种龟'} 的快捷流程`
    : `${breederName || '当前种龟'} 的快捷工作流`;
  const drawerDescription =
    '证书、夫妻图、分享入口与额度状态统一收进抽屉，详情主体只保留核心信息。';

  const certificateSteps: Array<{ id: CertificateStudioStep; label: string; ready: boolean }> = [
    {
      id: 'batch',
      label: '批次',
      ready: Boolean(studio.selectedEggEventId && studio.selectedSubjectMediaId),
    },
    {
      id: 'allocation',
      label: '客户',
      ready: Boolean(studio.buyerName.trim() || selectedAllocation?.buyerName),
    },
    { id: 'preview', label: '预览', ready: Boolean(certificatePreview || canConfirmCertificate) },
  ];

  const activeCertificateIndex = Math.max(
    0,
    certificateSteps.findIndex((item) => item.id === activeCertificateStep),
  );

  function renderCertificateStep() {
    if (activeCertificateStep === 'batch' || activeCertificateStep === 'subject') {
      return (
        <BatchStep
          studio={studio}
          setStudio={setStudio}
          eggEvents={eggEvents}
          eggEventOptionLabels={eggEventOptionLabels}
          saleBatches={saleBatches}
          selectedBatch={selectedBatch}
          selectedSubjectMedia={selectedSubjectMedia}
          uploadingSubjectMedia={uploadingSubjectMedia}
          onUploadMedia={onUploadSubjectMedia}
        />
      );
    }

    if (activeCertificateStep === 'allocation') {
      return <AllocationStep studio={studio} setStudio={setStudio} selectedBatch={selectedBatch} />;
    }

    return (
      <PreviewStep
        tenantSlug={tenantSlug}
        certificateEligibility={certificateEligibility}
        certificateRequirements={certificateRequirements}
        selectedBatch={selectedBatch}
        selectedAllocation={selectedAllocation}
        buyerName={studio.buyerName.trim()}
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
    );
  }

  return (
    <>
      <FloatingActionDock className="bottom-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <FloatingActionButton
          aria-label="打开证书、夫妻图与分享抽屉"
          title="打开快捷抽屉"
          className="h-14 w-14 rounded-full bg-neutral-950 !text-white shadow-[0_18px_40px_rgba(15,23,42,0.3)] hover:bg-neutral-900 hover:text-white"
          onClick={() => {
            onSectionChange('certificate');
            onOpenChange(true);
          }}
        >
          <Sparkles size={22} />
        </FloatingActionButton>
      </FloatingActionDock>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] bg-black/45"
          role="dialog"
          aria-modal="true"
          aria-label="种龟快捷工作流抽屉"
          onClick={() => onOpenChange(false)}
        >
          <section
            className="absolute inset-x-0 bottom-0 flex h-[90svh] max-h-[100svh] flex-col overflow-hidden rounded-t-[28px] border border-neutral-200 bg-[#fcfcfa] shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[min(92vw,44rem)] sm:rounded-none sm:rounded-l-[32px]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sticky top-0 z-20 border-b border-neutral-200 bg-[#fcfcfa]/95 px-4 py-3 backdrop-blur sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  {!isDirectMode ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
                      <Workflow size={14} />
                      Quick Asset Drawer
                    </div>
                  ) : null}
                  <p className="text-base font-semibold text-neutral-900 sm:text-lg">
                    {drawerTitle}
                  </p>
                  {!isDirectMode ? (
                    <p className="text-sm text-neutral-500">{drawerDescription}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  data-ui="button"
                  className={modalCloseButtonClass}
                  onClick={() => onOpenChange(false)}
                  aria-label="关闭抽屉"
                >
                  <X size={17} strokeWidth={2.6} />
                </button>
              </div>

              {!isDirectMode ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    data-ui="button"
                    className={buildFilterPillClass(activeSection === 'certificate')}
                    onClick={() => onSectionChange('certificate')}
                  >
                    证书生成
                  </button>
                  <button
                    type="button"
                    data-ui="button"
                    className={buildFilterPillClass(activeSection === 'share')}
                    onClick={() => onSectionChange('share')}
                  >
                    分享入口
                  </button>
                </div>
              ) : null}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                {assetError ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    {assetError}
                  </p>
                ) : null}

                {!isDirectMode ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[26px] border border-neutral-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Certificate
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-neutral-950">
                        {certificateStatus}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">{certificateMeta}</p>
                    </div>
                    <div className="rounded-[26px] border border-neutral-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                        Share
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-neutral-950">可分享</p>
                      <p className="mt-1 text-xs text-neutral-500">
                        分享当前种龟详情页，统一走弹窗内的二维码预览与复制动作，避免入口体验分叉。
                      </p>
                    </div>
                  </div>
                ) : null}

                {activeSection === 'certificate' ? (
                  <div className="space-y-4">
                    <div className="px-1 py-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          证书流程
                        </p>
                        <p className="text-xs text-neutral-500">
                          第 {activeCertificateIndex + 1} / {certificateSteps.length} 步
                        </p>
                      </div>
                      <div className="mt-3 flex items-start gap-2 overflow-x-auto pb-1 sm:overflow-visible">
                        {certificateSteps.map((step, index) => {
                          const isActive = step.id === activeCertificateStep;
                          const isUnlocked = index === 0 || isActive || step.ready;
                          const isComplete = step.ready && index < activeCertificateIndex;
                          const isLast = index === certificateSteps.length - 1;
                          const stepContent = (
                            <>
                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                                  isActive
                                    ? 'border-neutral-900 bg-neutral-900 text-white'
                                    : isComplete
                                      ? 'border-neutral-900 bg-neutral-900 text-white'
                                      : 'border-neutral-900 bg-white text-neutral-900'
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span
                                className={`mt-1 text-xs font-semibold ${isActive || isComplete ? 'text-neutral-900' : 'text-neutral-500'}`}
                              >
                                {step.label}
                              </span>
                            </>
                          );
                          return (
                            <Fragment key={step.id}>
                              <div className="flex min-w-[72px] flex-1 justify-center">
                                {isUnlocked ? (
                                  <button
                                    type="button"
                                    data-ui="button"
                                    className="group flex min-h-0 min-w-0 w-full max-w-[84px] appearance-none select-none flex-col items-center rounded-none border-0 bg-transparent p-0 text-center transition hover:bg-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0 active:bg-transparent"
                                    onClick={() => setActiveCertificateStep(step.id)}
                                  >
                                    {stepContent}
                                  </button>
                                ) : (
                                  <div
                                    aria-disabled="true"
                                    className="flex min-h-0 min-w-0 w-full max-w-[84px] select-none flex-col items-center rounded-none border-0 bg-transparent p-0 text-center pointer-events-none"
                                  >
                                    {stepContent}
                                  </div>
                                )}
                              </div>
                              {!isLast ? (
                                <div className="mt-4 h-px flex-1 bg-neutral-300">
                                  <div
                                    className={`h-full ${index < activeCertificateIndex ? 'bg-neutral-900' : 'bg-transparent'}`}
                                  />
                                </div>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-neutral-500">
                        第 1 步在同一卡片完成事件选择与主体图上传。
                      </p>
                    </div>

                    {renderCertificateStep()}

                    <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-200 bg-[#fcfcfa]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2.5 backdrop-blur sm:-mx-6 sm:px-6">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          data-ui="button"
                          className="inline-flex min-h-9 items-center justify-center rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() =>
                            setActiveCertificateStep(
                              certificateSteps[Math.max(activeCertificateIndex - 1, 0)]!.id,
                            )
                          }
                          disabled={activeCertificateIndex === 0}
                        >
                          上一步
                        </button>
                        <button
                          type="button"
                          data-ui="button"
                          className="inline-flex min-h-9 items-center justify-center rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:bg-neutral-500 disabled:text-white disabled:opacity-100"
                          onClick={() =>
                            setActiveCertificateStep(
                              certificateSteps[
                                Math.min(activeCertificateIndex + 1, certificateSteps.length - 1)
                              ]!.id,
                            )
                          }
                          disabled={
                            activeCertificateIndex === certificateSteps.length - 1 ||
                            !certificateSteps[activeCertificateIndex]?.ready
                          }
                        >
                          下一步
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeSection === 'share' ? (
                  <div className="space-y-4">
                    <div className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-2xl space-y-2">
                          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
                            <Share2 size={14} />
                            Share Entry
                          </div>
                          <h3 className="text-2xl font-semibold text-neutral-950">
                            先把分享动作做轻，不把用户推进海报生成链路。
                          </h3>
                          <p className="text-sm leading-6 text-neutral-500">
                            点击后会打开统一分享弹窗，展示当前种龟的公开详情链接、二维码与分享卡片预览，适合客服或销售直接转发。
                          </p>
                        </div>
                        <TenantShareDialogTrigger
                          intent={shareIntent}
                          title={`${breederName || '当前种龟'}分享`}
                          subtitle="扫码查看该种龟公开详情页，或复制链接直接转发。"
                          posterVariant="detail"
                          trigger={({ onClick, pending }) => (
                            <button
                              type="button"
                              data-ui="button"
                              className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:bg-neutral-500 disabled:text-white disabled:opacity-100"
                              onClick={onClick}
                              disabled={pending}
                            >
                              <Share2 size={16} />
                              {pending ? '正在生成...' : '打开分享弹窗'}
                            </button>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                          Audience
                        </p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">
                          面向客户的种龟详情分享
                        </p>
                        <p className="mt-2 text-sm leading-6 text-neutral-500">
                          直接落到该种龟的公开详情页，减少销售再解释“去哪里看”的中间步骤。
                        </p>
                      </div>
                      <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                          Current Scope
                        </p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">
                          只做入口，不做海报编辑
                        </p>
                        <p className="mt-2 text-sm leading-6 text-neutral-500">
                          业务先验证“能快速分享”是否足够，再决定是否补图文模板、海报下载和文案配置。
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
