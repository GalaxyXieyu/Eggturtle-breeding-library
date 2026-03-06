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
  type GetProductCertificateEligibilityResponse,
  type Product,
  type ProductCertificate,
  type ProductCertificateGenerateRequest,
  type ProductCertificatePreview,
  type ProductCouplePhoto,
  type ProductEvent,
  type ProductFamilyTree,
  type ProductImage,
  type SaleBatch
} from '@eggturtle/shared';
import { apiRequest, getAccessToken } from '@/lib/api-client';
import { switchTenantBySlug } from '@/lib/tenant-session';
import {
  buildLocalDateTimeValue,
  resolveImageUrl,
  formatError,
  formatEventYear,
  buildEventCollisionMeta,
  buildEventDetailLabel
} from '@/lib/breeder-utils';
import ProductDrawer from '@/components/product-drawer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CertificateStudioCard,
  CouplePhotoSection,
  BatchStep,
  AllocationStep,
  SubjectMediaStep,
  PreviewStep,
  useCertificateData,
  useCertificateStudio
} from '@/components/certificate-studio';
import { BreederInfoCard } from '@/components/breeder-detail/BreederInfoCard';
import { BreederImageGallery } from '@/components/breeder-detail/BreederImageGallery';
import { FamilyTreeView } from '@/components/breeder-detail/FamilyTreeView';
import { BreederEventTimeline } from '@/components/breeder-detail/BreederEventTimeline';

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
  saleBatches: []
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
  subjectFile: null
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
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'mating' | 'egg' | 'change_mate'>('all');
  const [eventExpanded, setEventExpanded] = useState(true);
  const [generatingCouplePhoto, setGeneratingCouplePhoto] = useState(false);
  const [data, setData] = useState<DetailState>({
    breeder: null,
    events: [],
    tree: null,
    images: []
  });
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAssetsState>(EMPTY_GENERATED_ASSETS);
  const [studio, setStudio] = useState<CertificateStudioState>(() => ({
    ...EMPTY_CERTIFICATE_STUDIO,
    soldAt: buildLocalDateTimeValue(new Date())
  }));
  const currentBreeder = data.breeder;

  const loadGeneratedAssets = useCallback(async (targetProductId: string) => {
    const [
      eligibilityResponse,
      certificatesResponse,
      currentCoupleResponse,
      coupleHistoryResponse,
      saleBatchesResponse
    ] = await Promise.all([
      apiRequest(`/products/${targetProductId}/certificates/eligibility`, {
        responseSchema: getProductCertificateEligibilityResponseSchema
      }),
      apiRequest(`/products/${targetProductId}/certificates`, {
        responseSchema: listProductCertificatesResponseSchema
      }),
      apiRequest(`/products/${targetProductId}/couple-photos/current`, {
        responseSchema: getCurrentProductCouplePhotoResponseSchema
      }),
      apiRequest(`/products/${targetProductId}/couple-photos/history`, {
        responseSchema: listProductCouplePhotosResponseSchema
      }),
      apiRequest(`/products/${targetProductId}/sale-batches`, {
        responseSchema: listSaleBatchesResponseSchema
      })
    ]);

    setGeneratedAssets((current) => ({
      ...current,
      certificateEligibility: eligibilityResponse,
      certificates: certificatesResponse.items,
      currentCouplePhoto: currentCoupleResponse.photo,
      couplePhotoHistory: coupleHistoryResponse.items,
      saleBatches: saleBatchesResponse.items
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
          buildEventDetailLabel(event, eventCollisionMeta.get(event.id))
        ])
      ),
    [data.events, eventCollisionMeta]
  );

  useEffect(() => {
    setGeneratedAssets(EMPTY_GENERATED_ASSETS);
    setStudio({
      ...EMPTY_CERTIFICATE_STUDIO,
      soldAt: buildLocalDateTimeValue(new Date())
    });
    setError(null);
    setLoading(true);

    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug || !breederId) {
      setError('缺少租户或种龟 ID。');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);

        const [productResponse, eventsResponse, treeResponse] = await Promise.all([
          apiRequest(`/products/${breederId}`, {
            responseSchema: getProductResponseSchema
          }),
          apiRequest(`/products/${breederId}/events`, {
            responseSchema: listProductEventsResponseSchema
          }),
          apiRequest(`/products/${breederId}/family-tree`, {
            responseSchema: getProductFamilyTreeResponseSchema
          })
        ]);

        const imageResponse = await apiRequest(`/products/${productResponse.product.id}/images`, {
          responseSchema: listProductImagesResponseSchema
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
            images
          });
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

  const activeImage = data.images.find((image) => image.id === activeImageId) ?? data.images[0] ?? null;
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
      return queryString ? `/app/${tenantSlug}/products?${queryString}` : `/app/${tenantSlug}/products`;
    }

    return queryString ? `/app/${tenantSlug}/breeders?${queryString}` : `/app/${tenantSlug}/breeders`;
  }, [fromProducts, isDemoMode, tenantSlug]);

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
      router.push(queryString ? `/app/${tenantSlug}/breeders/${nextBreederId}?${queryString}` : `/app/${tenantSlug}/breeders/${nextBreederId}`);
    };
  }, [fromProducts, isDemoMode, router, tenantSlug]);

  const eggEvents = useMemo(
    () =>
      [...data.events]
        .filter((event) => event.eventType === 'egg')
        .sort((left, right) => Date.parse(right.eventDate) - Date.parse(left.eventDate)),
    [data.events]
  );
  const certificateEligibility = generatedAssets.certificateEligibility;
  const certificateRequirements = certificateEligibility?.requirements;
  const saleBatches = generatedAssets.saleBatches;
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
    if (!selectedBatch || !selectedAllocation || !selectedSubjectMedia) {
      return null;
    }

    return {
      eggEventId: selectedBatch.eggEventId,
      saleBatchId: selectedBatch.id,
      saleAllocationId: selectedAllocation.id,
      subjectMediaId: selectedSubjectMedia.id,
      buyerName: selectedAllocation.buyerName,
      buyerAccountId: selectedAllocation.buyerAccountId ?? undefined
    };
  }, [selectedAllocation, selectedBatch, selectedSubjectMedia]);
  const canPreviewCertificate = Boolean(
    certificateRequest &&
      certificateRequirements?.hasSireCode &&
      certificateRequirements?.hasDamCode &&
      certificateRequirements?.hasParentGrandparentTrace
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
        selectedEggEventId: eggEvents[0].id
      };
    });
  }, [eggEvents]);

  useEffect(() => {
    setStudio((current) => {
      const fallbackEggEventId = current.selectedEggEventId || eggEvents[0]?.id || '';
      const matchedBatch = saleBatches.find((batch) => batch.id === current.selectedBatchId) ?? null;
      const fallbackBatch = matchedBatch ?? saleBatches.find((batch) => batch.eggEventId === fallbackEggEventId) ?? null;
      const nextBatchId = fallbackBatch?.id ?? '';
      const nextAllocationId = fallbackBatch?.allocations.some((item) => item.id === current.selectedAllocationId)
        ? current.selectedAllocationId
        : fallbackBatch?.allocations[0]?.id ?? '';
      const defaultSubjectMedia = fallbackBatch?.subjectMedia.find((item) => item.isPrimary) ?? fallbackBatch?.subjectMedia[0] ?? null;
      const nextSubjectMediaId = fallbackBatch?.subjectMedia.some((item) => item.id === current.selectedSubjectMediaId)
        ? current.selectedSubjectMediaId
        : defaultSubjectMedia?.id ?? '';

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
        selectedSubjectMediaId: nextSubjectMediaId
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
    certificatePreview: generatedAssets.certificatePreview
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
        certificatePreview: preview
      }));
    },
    onPreviewCleared: () => {
      setGeneratedAssets((current) => ({
        ...current,
        certificatePreview: null
      }));
    }
  });

  const handleGenerateCouplePhoto = useCallback(async () => {
    if (!breederId) {
      return;
    }

    setGeneratingCouplePhoto(true);

    try {
      await apiRequest(`/products/${breederId}/couple-photos/generate`, {
        method: 'POST',
        body: {},
        requestSchema: generateProductCouplePhotoRequestSchema,
        responseSchema: generateProductCouplePhotoResponseSchema
      });
      await loadGeneratedAssets(breederId);
    } catch (requestError) {
      certificateStudioHandlers.setAssetError(formatError(requestError));
    } finally {
      setGeneratingCouplePhoto(false);
    }
  }, [breederId, loadGeneratedAssets, certificateStudioHandlers]);

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <BreederInfoCard
        breeder={currentBreeder}
        activeImage={activeImage}
        listHref={listHref}
        tenantSlug={tenantSlug}
        onBack={() => router.push(listHref)}
        onEdit={() => setIsEditDrawerOpen(true)}
        onManageImages={() => router.push(`/app/${tenantSlug}/products/${currentBreeder?.id}`)}
        resolveImageUrl={resolveImageUrl}
      />

      {loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">正在加载种龟、事件和家族树数据...</p>
        </Card>
      ) : null}

      {!loading ? (
        <BreederImageGallery
          images={data.images}
          activeImageId={activeImageId}
          onImageClick={setActiveImageId}
          resolveImageUrl={resolveImageUrl}
        />
      ) : null}

      {!loading ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="text-2xl">证书与夫妻照</CardTitle>
            <CardDescription>证书按租户每月 100 张配额控制；夫妻照不限，归属母龟资产。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {certificateStudioHandlers.assetError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {certificateStudioHandlers.assetError}
              </p>
            ) : null}

            <div className="space-y-4">
              <CertificateStudioCard
                certificateEligibility={certificateEligibility}
                selectedBatch={selectedBatch}
                selectedSubjectMedia={selectedSubjectMedia}
              />

              <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
                <div className="space-y-4">
                  <BatchStep
                    studio={studio}
                    setStudio={setStudio}
                    eggEvents={certificateData.eggEvents}
                    eggEventOptionLabels={certificateData.eggEventOptionLabels}
                    saleBatches={saleBatches}
                    selectedBatch={selectedBatch}
                    creatingSaleBatch={certificateStudioHandlers.creatingSaleBatch}
                    onCreateBatch={certificateStudioHandlers.handleCreateSaleBatch}
                  />

                  <AllocationStep
                    studio={studio}
                    setStudio={setStudio}
                    selectedBatch={selectedBatch}
                    selectedAllocation={selectedAllocation}
                    creatingSaleAllocation={certificateStudioHandlers.creatingSaleAllocation}
                    onCreateAllocation={certificateStudioHandlers.handleCreateSaleAllocation}
                  />

                  <SubjectMediaStep
                    studio={studio}
                    setStudio={setStudio}
                    selectedBatch={selectedBatch}
                    selectedSubjectMedia={selectedSubjectMedia}
                    uploadingSubjectMedia={certificateStudioHandlers.uploadingSubjectMedia}
                    onUploadMedia={certificateStudioHandlers.handleUploadSubjectMedia}
                  />
                </div>

                <div className="space-y-4">
                  <PreviewStep
                    tenantSlug={tenantSlug}
                    certificateEligibility={certificateEligibility}
                    certificateRequirements={certificateRequirements}
                    selectedBatch={selectedBatch}
                    selectedAllocation={selectedAllocation}
                    selectedSubjectMedia={selectedSubjectMedia}
                    certificatePreview={generatedAssets.certificatePreview}
                    certificates={generatedAssets.certificates}
                    canPreviewCertificate={canPreviewCertificate}
                    canConfirmCertificate={canConfirmCertificate}
                    previewingCertificate={certificateStudioHandlers.previewingCertificate}
                    confirmingCertificate={certificateStudioHandlers.confirmingCertificate}
                    onPreview={certificateStudioHandlers.handlePreviewCertificate}
                    onConfirm={certificateStudioHandlers.handleConfirmCertificate}
                  />

                  <CouplePhotoSection
                    isFemaleBreeder={isFemaleBreeder}
                    currentCouplePhoto={generatedAssets.currentCouplePhoto}
                    couplePhotoHistory={generatedAssets.couplePhotoHistory}
                    generatingCouplePhoto={generatingCouplePhoto}
                    onGenerate={handleGenerateCouplePhoto}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && data.tree ? (
        <FamilyTreeView tree={data.tree} openBreederDetail={openBreederDetail} />
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

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Card>
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
            breeder: nextProduct
          }));
          setIsEditDrawerOpen(false);
        }}
      />
    </main>
  );
}
