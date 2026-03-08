import { useMemo } from 'react';
import type {
  GetProductCertificateEligibilityResponse,
  Product,
  ProductCertificate,
  ProductCertificateGenerateRequest,
  ProductCertificatePreview,
  ProductEvent,
  SaleBatch
} from '@eggturtle/shared';
import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import type { CertificateStudioState, CertificateStudioStep } from '@/components/certificate-studio/types';

type EventCollisionMeta = {
  duplicateCount: number;
  duplicateIndex: number;
};

const CERTIFICATE_STUDIO_STEPS: Array<{
  key: CertificateStudioStep;
  title: string;
  note: string;
}> = [
  { key: 'batch', title: '批次', note: '先选事件并上传主体图' },
  { key: 'allocation', title: '客户', note: '再填写客户信息' },
  { key: 'preview', title: '预览', note: '确认后正式发证' }
];

function resolveImageUrl(value: string) {
  return resolveAuthenticatedAssetUrl(value);
}

function formatEventShortDate(isoDate: string) {
  const d = new Date(isoDate);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}.${day}`;
}

function formatEventClock(isoDate: string) {
  const d = new Date(isoDate);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildEventSummary(event: ProductEvent) {
  if (event.eventType === 'mating') {
    return `公龟 ${event.maleCode || '-'}`;
  }
  if (event.eventType === 'egg') {
    return `数量 ${typeof event.eggCount === 'number' ? event.eggCount : '-'}`;
  }
  if (event.eventType === 'change_mate') {
    return `换公 ${(event.oldMateCode || '-') + ' → ' + (event.newMateCode || '-')}`;
  }
  return '-';
}

function buildEventCollisionMeta(events: ProductEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = `${event.eventType}|${event.eventDate}|${buildEventSummary(event)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  const meta = new Map<string, EventCollisionMeta>();
  for (const event of events) {
    const key = `${event.eventType}|${event.eventDate}|${buildEventSummary(event)}`;
    const duplicateIndex = (seen.get(key) ?? 0) + 1;
    seen.set(key, duplicateIndex);
    meta.set(event.id, {
      duplicateCount: counts.get(key) ?? 1,
      duplicateIndex
    });
  }

  return meta;
}

function buildEggEventOptionLabel(event: ProductEvent, collision?: EventCollisionMeta) {
  const baseLabel = `${formatEventShortDate(event.eventDate)} · ${buildEventSummary(event)}`;
  if (!collision || collision.duplicateCount <= 1) {
    return baseLabel;
  }

  return `${baseLabel} · ${formatEventClock(event.createdAt)}`;
}

interface UseCertificateDataParams {
  studio: CertificateStudioState;
  currentBreeder: Product | null;
  events: ProductEvent[];
  certificateEligibility: GetProductCertificateEligibilityResponse | null;
  saleBatches: SaleBatch[];
  certificates: ProductCertificate[];
  certificatePreview: ProductCertificatePreview | null;
}

export function useCertificateData({
  studio,
  currentBreeder,
  events,
  certificateEligibility,
  saleBatches,
  certificates,
  certificatePreview
}: UseCertificateDataParams) {
  const certificateRequirements = certificateEligibility?.requirements;

  const selectedBatch = useMemo(
    () => saleBatches.find((batch) => batch.id === studio.selectedBatchId) ?? null,
    [saleBatches, studio.selectedBatchId]
  );

  const selectedAllocation = useMemo(
    () => selectedBatch?.allocations.find((allocation) => allocation.id === studio.selectedAllocationId) ?? null,
    [selectedBatch, studio.selectedAllocationId]
  );

  const selectedSubjectMedia = useMemo(() => {
    if (!selectedBatch) {
      return null;
    }

    return selectedBatch.subjectMedia.find((media) => media.id === studio.selectedSubjectMediaId) ?? null;
  }, [selectedBatch, studio.selectedSubjectMediaId]);

  const certificateRequest = useMemo<ProductCertificateGenerateRequest | null>(() => {
    if (!studio.selectedEggEventId || !selectedSubjectMedia) {
      return null;
    }

    const buyerName = studio.buyerName.trim() || selectedAllocation?.buyerName?.trim() || '';
    if (!buyerName) {
      return null;
    }
    const soldAt =
      studio.soldAt && !Number.isNaN(Date.parse(studio.soldAt))
        ? new Date(studio.soldAt).toISOString()
        : undefined;

    return {
      eggEventId: studio.selectedEggEventId,
      saleBatchId: selectedBatch?.id || undefined,
      saleAllocationId: selectedAllocation?.id || undefined,
      subjectMediaId: selectedSubjectMedia.id,
      buyerName,
      buyerAccountId: studio.buyerAccountId.trim() || selectedAllocation?.buyerAccountId || undefined,
      buyerContact: studio.buyerContact.trim() || undefined,
      quantity: Number(studio.allocationQuantity) || 1,
      unitPrice: studio.unitPrice.trim() ? Number(studio.unitPrice) : undefined,
      channel: studio.channel.trim() || undefined,
      campaignId: studio.campaignId.trim() || undefined,
      soldAt,
      note: studio.allocationNote.trim() || undefined
    };
  }, [
    selectedAllocation,
    selectedBatch,
    selectedSubjectMedia,
    studio.allocationNote,
    studio.allocationQuantity,
    studio.buyerAccountId,
    studio.buyerContact,
    studio.buyerName,
    studio.campaignId,
    studio.channel,
    studio.selectedEggEventId,
    studio.soldAt,
    studio.unitPrice
  ]);

  const canPreviewCertificate = Boolean(
    certificateRequest &&
      certificateRequirements?.hasSireCode &&
      certificateRequirements?.hasDamCode &&
      certificateRequirements?.hasParentGrandparentTrace
  );

  const canConfirmCertificate = Boolean(certificateRequest && certificateEligibility?.eligible);

  const isFemaleBreeder = (currentBreeder?.sex ?? '').toLowerCase() === 'female';

  const latestCertificate = certificates[0] ?? null;

  const eggEvents = useMemo(
    () =>
      [...events]
        .filter((event) => event.eventType === 'egg')
        .sort((left, right) => Date.parse(right.eventDate) - Date.parse(left.eventDate)),
    [events]
  );

  const eventCollisionMeta = useMemo(() => buildEventCollisionMeta(events), [events]);

  const eggEventOptionLabels = useMemo(
    () =>
      new Map(
        eggEvents.map((event) => [
          event.id,
          buildEggEventOptionLabel(event, eventCollisionMeta.get(event.id))
        ])
      ),
    [eggEvents, eventCollisionMeta]
  );

  const selectedEggEvent = useMemo(
    () => eggEvents.find((event) => event.id === studio.selectedEggEventId) ?? null,
    [eggEvents, studio.selectedEggEventId]
  );

  const selectedEggEventLabel = useMemo(() => {
    if (!selectedEggEvent) {
      return '未选择生蛋事件';
    }

    return (
      eggEventOptionLabels.get(selectedEggEvent.id) ??
      `${formatEventShortDate(selectedEggEvent.eventDate)} · ${buildEventSummary(selectedEggEvent)}`
    );
  }, [eggEventOptionLabels, selectedEggEvent]);

  const nextCertificateStep = useMemo<CertificateStudioStep>(() => {
    if (!studio.selectedEggEventId || !selectedSubjectMedia) {
      return 'batch';
    }
    if (!studio.buyerName.trim() && !selectedAllocation?.buyerName?.trim()) {
      return 'allocation';
    }
    return 'preview';
  }, [selectedAllocation, selectedSubjectMedia, studio.buyerName, studio.selectedEggEventId]);

  const nextCertificateStepMeta =
    CERTIFICATE_STUDIO_STEPS.find((item) => item.key === nextCertificateStep) ?? CERTIFICATE_STUDIO_STEPS[0];

  const certificateProgressCount =
    Number(Boolean(studio.selectedEggEventId && selectedSubjectMedia)) +
    Number(Boolean(studio.buyerName.trim() || selectedAllocation?.buyerName?.trim()));

  const certificateRequirementPassCount = [
    Boolean(certificateRequirements?.hasSireCode),
    Boolean(certificateRequirements?.hasDamCode),
    Boolean(certificateRequirements?.hasParentGrandparentTrace)
  ].filter(Boolean).length;

  const certificateHero = useMemo(() => {
    if (certificatePreview) {
      return {
        src: `data:${certificatePreview.mimeType};base64,${certificatePreview.imageBase64}`,
        badge: '当前预览',
        title: certificatePreview.certNo,
        note: `验真 ID ${certificatePreview.verifyId}`
      };
    }

    if (latestCertificate) {
      return {
        src: resolveImageUrl(latestCertificate.contentPath),
        badge: '最近出证',
        title: latestCertificate.certNo,
        note: `V${latestCertificate.versionNo} · 验真 ID ${latestCertificate.verifyId}`
      };
    }

    return null;
  }, [certificatePreview, latestCertificate]);

  return {
    certificateRequirements,
    selectedBatch,
    selectedAllocation,
    selectedSubjectMedia,
    certificateRequest,
    canPreviewCertificate,
    canConfirmCertificate,
    isFemaleBreeder,
    latestCertificate,
    eggEvents,
    eggEventOptionLabels,
    selectedEggEvent,
    selectedEggEventLabel,
    nextCertificateStep,
    nextCertificateStepMeta,
    certificateProgressCount,
    certificateRequirementPassCount,
    certificateHero,
    CERTIFICATE_STUDIO_STEPS
  };
}
