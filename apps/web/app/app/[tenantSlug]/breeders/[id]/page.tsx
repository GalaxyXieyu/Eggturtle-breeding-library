'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  generateProductCouplePhotoRequestSchema,
  generateProductCouplePhotoResponseSchema,
  getCurrentProductCouplePhotoResponseSchema,
  getProductCertificateEligibilityResponseSchema,
  getProductFamilyTreeResponseSchema,
  getProductResponseSchema,
  listProductCertificatesResponseSchema,
  listProductCouplePhotosResponseSchema,
  listProductEventsResponseSchema,
  listProductImagesResponseSchema,
  listSaleBatchesResponseSchema,
  listSeriesResponseSchema,
  type GetProductCertificateEligibilityResponse,
  type Product,
  type ProductCertificate,
  type ProductCertificateGenerateRequest,
  type ProductCertificatePreview,
  type ProductCouplePhoto,
  type ProductEvent,
  type ProductFamilyTree,
  type ProductImage,
  type SaleBatch,
} from '@eggturtle/shared';
import { apiRequest, getAccessToken, resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { switchTenantBySlug } from '@/lib/tenant-session';
import {
  buildLocalDateTimeValue,
  resolveImageUrl,
  formatError,
  formatEventYear,
  buildEventCollisionMeta,
  buildEventDetailLabel,
} from '@/lib/breeder-utils';
import ProductDrawer, { type ProductSeriesOption } from '@/components/product-drawer';
import { Card } from '@/components/ui/card';
import TenantFloatingShareButton from '@/components/tenant-floating-share-button';
import { useCertificateData, useCertificateStudio } from '@/components/certificate-studio';
import {
  BreederAssetWorkflowDrawer,
  type DrawerMode,
  type DrawerSection,
} from '@/components/breeder-detail/BreederAssetWorkflowDrawer';
import { BreederInfoCard } from '@/components/breeder-detail/BreederInfoCard';
import { FamilyTreeView } from '@/components/breeder-detail/FamilyTreeView';
import { BreederEventTimeline } from '@/components/breeder-detail/BreederEventTimeline';
import { formatSeriesLabelById } from '@/app/app/[tenantSlug]/products/products-page-utils';

type DetailState = {
  breeder: Product | null;
  events: ProductEvent[];
  tree: ProductFamilyTree | null;
  images: ProductImage[];
};

type GeneratedAssetsState = {
  certificateEligibility: GetProductCertificateEligibilityResponse | null;
  certificates: ProductCertificate[];
  currentCouplePhoto: ProductCouplePhoto | null;
  couplePhotoHistory: ProductCouplePhoto[];
  certificatePreview: ProductCertificatePreview | null;
  saleBatches: SaleBatch[];
};

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

const EMPTY_GENERATED_ASSETS: GeneratedAssetsState = {
  certificateEligibility: null,
  certificates: [],
  currentCouplePhoto: null,
  couplePhotoHistory: [],
  certificatePreview: null,
  saleBatches: [],
};

const EMPTY_CERTIFICATE_STUDIO: CertificateStudioState = {
  selectedEggEventId: '',
  selectedBatchId: '',
  selectedAllocationId: '',
  selectedSubjectMediaId: '',
  plannedQuantity: '1',
  priceLow: '',
  priceHigh: '',
  batchNote: '',
  allocationQuantity: '1',
  buyerName: '',
  buyerAccountId: '',
  buyerContact: '',
  unitPrice: '',
  channel: '朋友圈',
  campaignId: '',
  allocationNote: '',
  soldAt: '',
  subjectLabel: '成交主体图',
  subjectIsPrimary: true,
  subjectFile: null,
};

export default function BreederDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string; tenantSlug: string }>();
  const searchParams = useSearchParams();
  const breederId = useMemo(() => params.id ?? '', [params.id]);
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);
  const fromProducts = searchParams.get('from') === 'products';
  const isDemoMode = searchParams.get('demo') === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seriesOptions, setSeriesOptions] = useState<ProductSeriesOption[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'mating' | 'egg' | 'change_mate'>('all');
  const [eventExpanded, setEventExpanded] = useState(true);
  const [, setGeneratingCouplePhoto] = useState(false);
  const [quickActionError, setQuickActionError] = useState<string | null>(null);
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);
  const [assetDrawerSection, setAssetDrawerSection] = useState<DrawerSection>('certificate');
  const [assetDrawerMode, setAssetDrawerMode] = useState<DrawerMode>('quick');
  const [data, setData] = useState<DetailState>({
    breeder: null,
    events: [],
    tree: null,
    images: [],
  });
  const [generatedAssets, setGeneratedAssets] =
    useState<GeneratedAssetsState>(EMPTY_GENERATED_ASSETS);
  const [studio, setStudio] = useState<CertificateStudioState>(() => ({
    ...EMPTY_CERTIFICATE_STUDIO,
    soldAt: buildLocalDateTimeValue(new Date()),
  }));
  const currentBreeder = data.breeder;

  const loadGeneratedAssets = useCallback(async (targetProductId: string) => {
    const [
      eligibilityResponse,
      certificatesResponse,
      currentCoupleResponse,
      coupleHistoryResponse,
      saleBatchesResponse,
    ] = await Promise.all([
      apiRequest(`/products/${targetProductId}/certificates/eligibility`, {
        responseSchema: getProductCertificateEligibilityResponseSchema,
      }),
      apiRequest(`/products/${targetProductId}/certificates`, {
        responseSchema: listProductCertificatesResponseSchema,
      }),
      apiRequest(`/products/${targetProductId}/couple-photos/current`, {
        responseSchema: getCurrentProductCouplePhotoResponseSchema,
      }),
      apiRequest(`/products/${targetProductId}/couple-photos/history`, {
        responseSchema: listProductCouplePhotosResponseSchema,
      }),
      apiRequest(`/products/${targetProductId}/sale-batches`, {
        responseSchema: listSaleBatchesResponseSchema,
      }),
    ]);

    setGeneratedAssets((current) => ({
      ...current,
      certificateEligibility: eligibilityResponse,
      certificates: certificatesResponse.items,
      currentCouplePhoto: currentCoupleResponse.photo,
      couplePhotoHistory: coupleHistoryResponse.items,
      saleBatches: saleBatchesResponse.items,
    }));
  }, []);

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return data.events;
    return data.events.filter((e) => e.eventType === eventFilter);
  }, [data.events, eventFilter]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, ProductEvent[]>();
    for (const event of filteredEvents) {
      const year = formatEventYear(event.eventDate);
      const current = groups.get(year);
      if (current) {
        current.push(event);
      } else {
        groups.set(year, [event]);
      }
    }
    return Array.from(groups.entries()).map(([year, items]) => ({ year, items }));
  }, [filteredEvents]);
  const eventCollisionMeta = useMemo(() => buildEventCollisionMeta(data.events), [data.events]);
  const eventDetailLabels = useMemo(
    () =>
      new Map(
        data.events.map((event) => [
          event.id,
          buildEventDetailLabel(event, eventCollisionMeta.get(event.id)),
        ]),
      ),
    [data.events, eventCollisionMeta],
  );

  useEffect(() => {
    setGeneratedAssets(EMPTY_GENERATED_ASSETS);
    setStudio({
      ...EMPTY_CERTIFICATE_STUDIO,
      soldAt: buildLocalDateTimeValue(new Date()),
    });
    setError(null);
    setLoading(true);

    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug || !breederId) {
      setError('缺少用户或种龟 ID。');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);

        const [productResponse, eventsResponse, treeResponse, seriesResponse] = await Promise.all([
          apiRequest(`/products/${breederId}`, {
            responseSchema: getProductResponseSchema,
          }),
          apiRequest(`/products/${breederId}/events`, {
            responseSchema: listProductEventsResponseSchema,
          }),
          apiRequest(`/products/${breederId}/family-tree`, {
            responseSchema: getProductFamilyTreeResponseSchema,
          }),
          apiRequest('/series?page=1&pageSize=100', {
            responseSchema: listSeriesResponseSchema,
          }),
        ]);

        const imageResponse = await apiRequest(`/products/${productResponse.product.id}/images`, {
          responseSchema: listProductImagesResponseSchema,
        });
        const images = imageResponse.images;

        try {
          await loadGeneratedAssets(productResponse.product.id);
        } catch (assetRequestError) {
          if (!cancelled) {
            certificateStudioHandlers.setAssetError(formatError(assetRequestError));
          }
        }

        if (!cancelled) {
          setData({
            breeder: productResponse.product,
            events: eventsResponse.events,
            tree: treeResponse.tree,
            images,
          });
          setSeriesOptions(
            seriesResponse.items.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name,
            })),
          );
          setActiveImageId(images[0]?.id ?? null);
          setError(null);
          setLoading(false);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatError(requestError));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breederId, loadGeneratedAssets, router, tenantSlug]);

  const activeImage =
    data.images.find((image) => image.id === activeImageId) ?? data.images[0] ?? null;
  const detailShareTitle = useMemo(
    () => `${currentBreeder?.name?.trim() || currentBreeder?.code || '当前种龟'}分享`,
    [currentBreeder?.code, currentBreeder?.name],
  );
  const detailSharePreviewImage = useMemo(() => {
    const currentImage = activeImage?.url?.trim();
    if (currentImage) {
      return resolveAuthenticatedAssetUrl(currentImage);
    }

    const fallbackImage = currentBreeder?.coverImageUrl?.trim();
    return fallbackImage ? resolveAuthenticatedAssetUrl(fallbackImage) : null;
  }, [activeImage?.url, currentBreeder?.coverImageUrl]);
  const seriesLabel = useMemo(() => {
    const seriesId = currentBreeder?.seriesId?.trim();
    if (!seriesId) {
      return null;
    }

    return formatSeriesLabelById(seriesId, seriesOptions);
  }, [currentBreeder?.seriesId, seriesOptions]);
  const relationIds = useMemo(
    () => ({
      父本: data.tree?.sire?.id ?? null,
      母本: data.tree?.dam?.id ?? null,
      配偶: data.tree?.mate?.id ?? null,
    }),
    [data.tree],
  );
  const listHref = useMemo(() => {
    const query = new URLSearchParams();
    if (isDemoMode) {
      query.set('demo', '1');
    }

    if (fromProducts) {
      query.set('view', 'preview');
    }

    const queryString = query.toString();
    if (fromProducts) {
      return queryString
        ? `/app/${tenantSlug}/products?${queryString}`
        : `/app/${tenantSlug}/products`;
    }

    return queryString
      ? `/app/${tenantSlug}/breeders?${queryString}`
      : `/app/${tenantSlug}/breeders`;
  }, [fromProducts, isDemoMode, tenantSlug]);
  const closeDetail = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(listHref);
  }, [listHref, router]);

  const openBreederDetail = useMemo(() => {
    return (nextBreederId: string) => {
      const query = new URLSearchParams();
      if (fromProducts) {
        query.set('from', 'products');
      }
      if (isDemoMode) {
        query.set('demo', '1');
      }

      const queryString = query.toString();
      router.push(
        queryString
          ? `/app/${tenantSlug}/breeders/${nextBreederId}?${queryString}`
          : `/app/${tenantSlug}/breeders/${nextBreederId}`,
      );
    };
  }, [fromProducts, isDemoMode, router, tenantSlug]);

  const eggEvents = useMemo(
    () =>
      [...data.events]
        .filter((event) => event.eventType === 'egg')
        .sort((left, right) => Date.parse(right.eventDate) - Date.parse(left.eventDate)),
    [data.events],
  );
  const certificateEligibility = generatedAssets.certificateEligibility;
  const certificateRequirements = certificateEligibility?.requirements;
  const saleBatches = generatedAssets.saleBatches;
  const selectedBatch = useMemo(
    () => saleBatches.find((batch) => batch.id === studio.selectedBatchId) ?? null,
    [saleBatches, studio.selectedBatchId],
  );
  const selectedAllocation = useMemo(
    () =>
      selectedBatch?.allocations.find(
        (allocation) => allocation.id === studio.selectedAllocationId,
      ) ?? null,
    [selectedBatch, studio.selectedAllocationId],
  );
  const selectedSubjectMedia = useMemo(() => {
    if (!selectedBatch) {
      return null;
    }

    return (
      selectedBatch.subjectMedia.find((media) => media.id === studio.selectedSubjectMediaId) ?? null
    );
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
      buyerAccountId:
        studio.buyerAccountId.trim() || selectedAllocation?.buyerAccountId || undefined,
      buyerContact: studio.buyerContact.trim() || undefined,
      quantity: Number(studio.allocationQuantity) || 1,
      unitPrice: studio.unitPrice.trim() ? Number(studio.unitPrice) : undefined,
      channel: studio.channel.trim() || undefined,
      campaignId: studio.campaignId.trim() || undefined,
      soldAt,
      note: studio.allocationNote.trim() || undefined,
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
    studio.unitPrice,
  ]);
  const canPreviewCertificate = Boolean(
    certificateRequest &&
    certificateRequirements?.hasSireCode &&
    certificateRequirements?.hasDamCode &&
    certificateRequirements?.hasParentGrandparentTrace,
  );
  const canConfirmCertificate = Boolean(certificateRequest && certificateEligibility?.eligible);
  const isFemaleBreeder = (currentBreeder?.sex ?? '').toLowerCase() === 'female';

  useEffect(() => {
    if (eggEvents.length === 0) {
      return;
    }

    setStudio((current) => {
      if (current.selectedEggEventId) {
        return current;
      }

      return {
        ...current,
        selectedEggEventId: eggEvents[0].id,
      };
    });
  }, [eggEvents]);

  useEffect(() => {
    setStudio((current) => {
      const fallbackEggEventId = current.selectedEggEventId || eggEvents[0]?.id || '';
      const matchedBatch =
        saleBatches.find((batch) => batch.id === current.selectedBatchId) ?? null;
      const fallbackBatch =
        matchedBatch ??
        saleBatches.find((batch) => batch.eggEventId === fallbackEggEventId) ??
        null;
      const nextBatchId = fallbackBatch?.id ?? '';
      const nextAllocationId = fallbackBatch?.allocations.some(
        (item) => item.id === current.selectedAllocationId,
      )
        ? current.selectedAllocationId
        : '';
      const defaultSubjectMedia =
        fallbackBatch?.subjectMedia.find((item) => item.isPrimary) ??
        fallbackBatch?.subjectMedia[0] ??
        null;
      const nextSubjectMediaId = fallbackBatch?.subjectMedia.some(
        (item) => item.id === current.selectedSubjectMediaId,
      )
        ? current.selectedSubjectMediaId
        : (defaultSubjectMedia?.id ?? '');

      if (
        current.selectedEggEventId === fallbackEggEventId &&
        current.selectedBatchId === nextBatchId &&
        current.selectedAllocationId === nextAllocationId &&
        current.selectedSubjectMediaId === nextSubjectMediaId
      ) {
        return current;
      }

      return {
        ...current,
        selectedEggEventId: fallbackEggEventId,
        selectedBatchId: nextBatchId,
        selectedAllocationId: nextAllocationId,
        selectedSubjectMediaId: nextSubjectMediaId,
      };
    });
  }, [eggEvents, saleBatches]);

  // Certificate studio hooks
  const certificateData = useCertificateData({
    studio,
    currentBreeder,
    events: data.events,
    certificateEligibility,
    saleBatches,
    certificates: generatedAssets.certificates,
    certificatePreview: generatedAssets.certificatePreview,
  });

  const certificateStudioHandlers = useCertificateStudio({
    breederId,
    studio,
    setStudio,
    certificateRequest,
    onRefreshAssets: async () => {
      if (breederId) {
        await loadGeneratedAssets(breederId);
      }
    },
    onPreviewGenerated: (preview) => {
      setGeneratedAssets((current) => ({
        ...current,
        certificatePreview: preview,
      }));
    },
    onPreviewCleared: () => {
      setGeneratedAssets((current) => ({
        ...current,
        certificatePreview: null,
      }));
    },
  });

  const handleAssetDrawerOpenChange = useCallback((open: boolean) => {
    setIsAssetDrawerOpen(open);
    if (!open) {
      setAssetDrawerMode('quick');
    }
  }, []);

  const openCouplePhotoPreview = useCallback((contentPath: string) => {
    const target = resolveImageUrl(contentPath);
    const popup = window.open(target, '_blank', 'noopener');
    if (!popup) {
      window.location.href = target;
    }
  }, []);

  const handleGenerateCouplePhoto = useCallback(
    async (openPreview = false) => {
      if (!breederId) {
        return;
      }

      setGeneratingCouplePhoto(true);
      setQuickActionError(null);

      try {
        const response = await apiRequest(`/products/${breederId}/couple-photos/generate`, {
          method: 'POST',
          body: {},
          requestSchema: generateProductCouplePhotoRequestSchema,
          responseSchema: generateProductCouplePhotoResponseSchema,
        });
        if (openPreview) {
          openCouplePhotoPreview(response.photo.contentPath);
        }
        await loadGeneratedAssets(breederId);
      } catch (requestError) {
        const message = formatError(requestError);
        certificateStudioHandlers.setAssetError(message);
        setQuickActionError(message);
      } finally {
        setGeneratingCouplePhoto(false);
      }
    },
    [breederId, loadGeneratedAssets, certificateStudioHandlers, openCouplePhotoPreview],
  );

  const handleCouplePhotoAction = useCallback(() => {
    if (!isFemaleBreeder) {
      return;
    }

    setQuickActionError(null);

    if (generatedAssets.currentCouplePhoto) {
      openCouplePhotoPreview(generatedAssets.currentCouplePhoto.contentPath);
      return;
    }

    void handleGenerateCouplePhoto(true);
  }, [
    generatedAssets.currentCouplePhoto,
    handleGenerateCouplePhoto,
    isFemaleBreeder,
    openCouplePhotoPreview,
  ]);

  return (
    <main className="tenant-mobile-dock-safe space-y-4 pb-10 sm:space-y-6 lg:pb-10">
      <BreederInfoCard
        breeder={currentBreeder}
        seriesLabel={seriesLabel}
        images={data.images}
        activeImage={activeImage}
        activeImageId={activeImageId}
        relationIds={relationIds}
        onImageClick={setActiveImageId}
        onBack={closeDetail}
        onEdit={() => setIsEditDrawerOpen(true)}
        onOpenRelation={openBreederDetail}
        actionErrorMessage={quickActionError}
        onOpenCertificateDrawer={() => {
          setQuickActionError(null);
          setAssetDrawerMode('direct');
          setAssetDrawerSection('certificate');
          setIsAssetDrawerOpen(true);
        }}
        onOpenCouplePhotoDrawer={handleCouplePhotoAction}
        actionsDisabled={loading || !currentBreeder}
        resolveImageUrl={resolveImageUrl}
      />

      {loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">正在加载种龟、事件和家族树数据...</p>
        </Card>
      ) : null}

      {!loading ? (
        <BreederEventTimeline
          events={data.events}
          eventFilter={eventFilter}
          setEventFilter={setEventFilter}
          eventExpanded={eventExpanded}
          setEventExpanded={setEventExpanded}
          filteredEvents={filteredEvents}
          groupedEvents={groupedEvents}
          eventDetailLabels={eventDetailLabels}
        />
      ) : null}

      {!loading && data.tree ? (
        <FamilyTreeView tree={data.tree} openBreederDetail={openBreederDetail} />
      ) : null}

      {!loading && currentBreeder ? (
        <BreederAssetWorkflowDrawer
          breederId={currentBreeder.id}
          breederName={currentBreeder.name?.trim() || currentBreeder.code || '当前种龟'}
          tenantSlug={tenantSlug}
          eggEvents={certificateData.eggEvents}
          eggEventOptionLabels={certificateData.eggEventOptionLabels}
          certificateEligibility={certificateEligibility}
          certificateRequirements={certificateRequirements}
          saleBatches={saleBatches}
          selectedBatch={selectedBatch}
          selectedAllocation={selectedAllocation}
          selectedSubjectMedia={selectedSubjectMedia}
          certificates={generatedAssets.certificates}
          certificatePreview={generatedAssets.certificatePreview}
          canPreviewCertificate={canPreviewCertificate}
          canConfirmCertificate={canConfirmCertificate}
          previewingCertificate={certificateStudioHandlers.previewingCertificate}
          confirmingCertificate={certificateStudioHandlers.confirmingCertificate}
          uploadingSubjectMedia={certificateStudioHandlers.uploadingSubjectMedia}
          assetError={certificateStudioHandlers.assetError}
          studio={studio}
          setStudio={setStudio}
          onPreviewCertificate={certificateStudioHandlers.handlePreviewCertificate}
          onConfirmCertificate={certificateStudioHandlers.handleConfirmCertificate}
          onUploadSubjectMedia={certificateStudioHandlers.handleUploadSubjectMedia}
          isOpen={isAssetDrawerOpen}
          activeSection={assetDrawerSection}
          mode={assetDrawerMode}
          onOpenChange={handleAssetDrawerOpenChange}
          onSectionChange={setAssetDrawerSection}
        />
      ) : null}

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
      ) : null}

      {!loading && currentBreeder ? (
        <TenantFloatingShareButton
          intent={{ productId: currentBreeder.id }}
          title={detailShareTitle}
          subtitle="扫码查看该种龟公开详情页，或复制链接直接转发。"
          previewImageUrl={detailSharePreviewImage}
          posterVariant="detail"
          className="lg:hidden"
        />
      ) : null}

      <ProductDrawer
        mode="edit"
        open={isEditDrawerOpen}
        product={currentBreeder}
        tenantSlug={tenantSlug}
        isDemoMode={isDemoMode}
        onClose={() => setIsEditDrawerOpen(false)}
        onSaved={(nextProduct) => {
          setData((current) => ({
            ...current,
            breeder: nextProduct,
          }));
          setIsEditDrawerOpen(false);
        }}
      />
    </main>
  );
}
