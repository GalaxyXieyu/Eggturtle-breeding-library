'use client';

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
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
import {
  FileBadge2,
  HeartHandshake,
  Layers3,
  Link2,
  Share2,
  Sparkles,
  Workflow,
  X
} from 'lucide-react';

import {
  AllocationStep,
  BatchStep,
  CertificateStudioCard,
  CouplePhotoSection,
  PreviewStep,
  SubjectMediaStep
} from '@/components/certificate-studio';
import { buildFilterPillClass } from '@/components/filter-pill';
import { FloatingActionButton, FloatingActionDock, modalCloseButtonClass } from '@/components/ui/floating-actions';
import { formatApiError } from '@/lib/error-utils';
import { createTenantFeedShareLink } from '@/lib/tenant-share';

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

type DrawerSection = 'overview' | 'certificate' | 'couple-photo' | 'share';

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

function QuickEntryCard({
  icon,
  eyebrow,
  title,
  description,
  meta,
  actionLabel,
  onClick
}: {
  icon: ReactNode;
  eyebrow: string;
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">{eyebrow}</p>
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<DrawerSection>('overview');
  const [sharePending, setSharePending] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!shareNotice) {
      return;
    }

    const timer = window.setTimeout(() => setShareNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [shareNotice]);

  const certificateMeta = useMemo(() => {
    const remaining = certificateEligibility?.quota.remaining ?? 0;
    const limit = certificateEligibility?.quota.limit ?? 100;
    return `本月剩余 ${remaining} / ${limit}；已出证 ${certificates.length} 张。`;
  }, [certificateEligibility, certificates.length]);

  const coupleMeta = useMemo(() => {
    if (!isFemaleBreeder) {
      return '当前为公龟，本轮先保留入口和状态说明，不开放生成。';
    }

    return currentCouplePhoto
      ? `当前已有 1 张生效夫妻照，历史累计 ${couplePhotoHistory.length} 张。`
      : `当前暂无生效夫妻照，历史累计 ${couplePhotoHistory.length} 张。`;
  }, [couplePhotoHistory.length, currentCouplePhoto, isFemaleBreeder]);

  const certificateStatus = useMemo(() => {
    if (!certificateEligibility) {
      return '待检查';
    }

    return certificateEligibility.eligible ? '可出证' : '待补齐';
  }, [certificateEligibility]);

  async function handleShareEntry() {
    if (sharePending) {
      return;
    }

    setSharePending(true);
    setShareError(null);
    setShareNotice(null);

    try {
      const share = await createTenantFeedShareLink({
        intent: { productId: breederId },
        missingTenantMessage: '当前租户上下文未就绪，暂时无法生成分享链接。'
      });
      const url = share.permanentUrl;

      try {
        await navigator.clipboard.writeText(url);
        setShareNotice('已复制分享链接。');
      } catch {
        setShareError('分享链接已生成，但自动复制失败，请手动复制。');
      }

      const opened = window.open(url, '_blank');
      if (!opened) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      setShareError(formatApiError(error, '创建分享链接失败'));
    } finally {
      setSharePending(false);
    }
  }

  function openDrawer(section: DrawerSection) {
    setIsOpen(true);
    setActiveSection(section);
  }

  return (
    <>
      <FloatingActionDock className="bottom-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <FloatingActionButton
          aria-label="打开证书、夫妻图与分享抽屉"
          title="打开快捷抽屉"
          className="h-14 w-14 rounded-full bg-neutral-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.3)] hover:bg-neutral-900"
          onClick={() => openDrawer('overview')}
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
          onClick={() => setIsOpen(false)}
        >
          <section
            className="absolute inset-x-0 bottom-0 flex h-[86svh] flex-col overflow-hidden rounded-t-[32px] border border-neutral-200 bg-[#fcfcfa] shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[min(92vw,44rem)] sm:rounded-none sm:rounded-l-[32px]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="sticky top-0 z-20 border-b border-neutral-200 bg-[#fcfcfa]/95 px-4 py-4 backdrop-blur sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600">
                    <Workflow size={14} />
                    Quick Asset Drawer
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-neutral-900">{breederName || '当前种龟'} 的快捷工作流</p>
                    <p className="text-sm text-neutral-500">证书、夫妻图、分享入口与额度状态统一收进抽屉，详情主体只保留核心信息。</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={modalCloseButtonClass}
                  onClick={() => setIsOpen(false)}
                  aria-label="关闭抽屉"
                >
                  <X size={17} strokeWidth={2.6} />
                </button>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  className={buildFilterPillClass(activeSection === 'overview')}
                  onClick={() => setActiveSection('overview')}
                >
                  总览
                </button>
                <button
                  type="button"
                  className={buildFilterPillClass(activeSection === 'certificate')}
                  onClick={() => setActiveSection('certificate')}
                >
                  证书生成
                </button>
                <button
                  type="button"
                  className={buildFilterPillClass(activeSection === 'couple-photo')}
                  onClick={() => setActiveSection('couple-photo')}
                >
                  夫妻图
                </button>
                <button
                  type="button"
                  className={buildFilterPillClass(activeSection === 'share')}
                  onClick={() => setActiveSection('share')}
                >
                  分享入口
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                {assetError ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    {assetError}
                  </p>
                ) : null}

                {shareError ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    {shareError}
                  </p>
                ) : null}

                {shareNotice ? (
                  <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    {shareNotice}
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[26px] border border-neutral-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Certificate</p>
                    <p className="mt-2 text-2xl font-semibold text-neutral-950">{certificateStatus}</p>
                    <p className="mt-1 text-xs text-neutral-500">{certificateMeta}</p>
                  </div>
                  <div className="rounded-[26px] border border-neutral-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Couple Photo</p>
                    <p className="mt-2 text-2xl font-semibold text-neutral-950">{currentCouplePhoto ? '已就绪' : '待生成'}</p>
                    <p className="mt-1 text-xs text-neutral-500">{coupleMeta}</p>
                  </div>
                  <div className="rounded-[26px] border border-neutral-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Share</p>
                    <p className="mt-2 text-2xl font-semibold text-neutral-950">可分享</p>
                    <p className="mt-1 text-xs text-neutral-500">分享当前种龟详情页，先提供外链入口与复制动作，不引入海报生成链路。</p>
                  </div>
                </div>

                {activeSection === 'overview' ? (
                  <div className="space-y-4">
                    <div className="rounded-[30px] border border-neutral-200 bg-neutral-950 px-5 py-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-2xl space-y-2">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/72">
                            <Layers3 size={14} />
                            Drawer First
                          </div>
                          <h3 className="text-2xl font-semibold leading-tight">右下角只留一个快捷入口，主体信息不再被大卡片挤占。</h3>
                          <p className="text-sm leading-6 text-white/70">
                            这一版先把证书、夫妻图、分享入口和额度状态都收进同一抽屉，后续再按使用频次继续细分。
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-[#FFF6BF] disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleShareEntry()}
                          disabled={sharePending}
                        >
                          <Share2 size={16} />
                          {sharePending ? '正在生成分享链接...' : '立即分享'}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <QuickEntryCard
                        icon={<FileBadge2 size={18} />}
                        eyebrow="Certificate"
                        title="生成证书"
                        description="继续沿用批次、客户分配、主体图和预览出证四步，入口改为抽屉内切换。"
                        meta={certificateMeta}
                        actionLabel="进入"
                        onClick={() => setActiveSection('certificate')}
                      />
                      <QuickEntryCard
                        icon={<HeartHandshake size={18} />}
                        eyebrow="Couple Photo"
                        title="夫妻图"
                        description="保留当前生效图与历史浏览，母龟可直接在抽屉里发起生成。"
                        meta={coupleMeta}
                        actionLabel="进入"
                        onClick={() => setActiveSection('couple-photo')}
                      />
                      <QuickEntryCard
                        icon={<Link2 size={18} />}
                        eyebrow="Share Entry"
                        title="分享入口"
                        description="本轮先做分享外链入口，生成即复制并打开，不把用户带进海报制作流程。"
                        meta="点击后会打开当前种龟的公开详情页。"
                        actionLabel="打开"
                        onClick={() => setActiveSection('share')}
                      />
                    </div>
                  </div>
                ) : null}

                {activeSection === 'certificate' ? (
                  <div className="space-y-4">
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
                ) : null}

                {activeSection === 'couple-photo' ? (
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-neutral-900 bg-neutral-950 px-5 py-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
                      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/72">
                            <HeartHandshake size={14} />
                            Couple Photo Studio
                          </div>
                          <h3 className="text-2xl font-semibold leading-tight">夫妻图现在只在抽屉里处理，不再占据详情页主体版面。</h3>
                          <p className="text-sm leading-6 text-white/70">
                            当前保留生成入口、当前生效图和历史记录；公龟仍可看到状态说明，但不会误触生成动作。
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
                          <h3 className="text-2xl font-semibold text-neutral-950">先把分享动作做轻，不把用户推进海报生成链路。</h3>
                          <p className="text-sm leading-6 text-neutral-500">
                            点击后会创建当前种龟的公开详情链接，自动复制到剪贴板，并在新标签页打开，适合客服或销售直接转发。
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void handleShareEntry()}
                          disabled={sharePending}
                        >
                          <Share2 size={16} />
                          {sharePending ? '正在生成...' : '复制并打开分享链接'}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Audience</p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">面向客户的种龟详情分享</p>
                        <p className="mt-2 text-sm leading-6 text-neutral-500">
                          直接落到该种龟的公开详情页，减少销售再解释“去哪里看”的中间步骤。
                        </p>
                      </div>
                      <div className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Current Scope</p>
                        <p className="mt-2 text-lg font-semibold text-neutral-950">只做入口，不做海报编辑</p>
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
