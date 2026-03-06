'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  confirmProductCertificateGenerateResponseSchema,
  createSaleAllocationRequestSchema,
  createSaleAllocationResponseSchema,
  createSaleBatchRequestSchema,
  createSaleBatchResponseSchema,
  createSaleSubjectMediaResponseSchema,
  generateProductCertificatePreviewResponseSchema,
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
  productCertificateGenerateRequestSchema,
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
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  Gem,
  Image as ImageIcon,
  Network,
  PencilRuler,
  ShieldCheck,
  Stamp
} from 'lucide-react';

import { ApiError, apiRequest, getAccessToken, resolveAuthenticatedAssetUrl } from '../../../../../lib/api-client';
import { formatSex } from '../../../../../lib/pet-format';
import { switchTenantBySlug } from '../../../../../lib/tenant-session';
import { cn } from '../../../../../lib/utils';
import ProductDrawer from '../../../../../components/product-drawer';
import { Badge } from '../../../../../components/ui/badge';
import { Button } from '../../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../components/ui/card';
import { Input } from '../../../../../components/ui/input';
import { Label } from '../../../../../components/ui/label';
import { NativeSelect } from '../../../../../components/ui/native-select';
import { buildInteractivePillClass } from '../../../../../components/ui/pill';
import { Textarea } from '../../../../../components/ui/textarea';

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

type FamilyTreeNode = ProductFamilyTree['self'] | ProductFamilyTree['children'][number];

const EVENT_FILTER_OPTIONS = [
  { key: 'all' as const, title: '全部' },
  { key: 'mating' as const, title: '交配' },
  { key: 'egg' as const, title: '产蛋' },
  { key: 'change_mate' as const, title: '换公' }
];

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
  const [assetError, setAssetError] = useState<string | null>(null);
  const [previewingCertificate, setPreviewingCertificate] = useState(false);
  const [confirmingCertificate, setConfirmingCertificate] = useState(false);
  const [creatingSaleBatch, setCreatingSaleBatch] = useState(false);
  const [creatingSaleAllocation, setCreatingSaleAllocation] = useState(false);
  const [uploadingSubjectMedia, setUploadingSubjectMedia] = useState(false);
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
    setAssetError(null);
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
    setAssetError(null);
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
            setAssetError(formatError(assetRequestError));
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

  const refreshGeneratedAssets = useCallback(async () => {
    if (!breederId) {
      return;
    }

    try {
      await loadGeneratedAssets(breederId);
    } catch (requestError) {
      setAssetError(formatError(requestError));
    }
  }, [breederId, loadGeneratedAssets]);

  const handleCreateSaleBatch = useCallback(async () => {
    if (!breederId) {
      return;
    }

    if (!studio.selectedEggEventId) {
      setAssetError('请先选择一个生蛋事件，再创建销售批次。');
      return;
    }

    setCreatingSaleBatch(true);

    try {
      const response = await apiRequest(`/products/${breederId}/sale-batches`, {
        method: 'POST',
        body: {
          eggEventId: studio.selectedEggEventId,
          plannedQuantity: Number.parseInt(studio.plannedQuantity || '1', 10) || 1,
          priceLow: parseOptionalDecimalInput(studio.priceLow),
          priceHigh: parseOptionalDecimalInput(studio.priceHigh),
          note: studio.batchNote.trim() || undefined
        },
        requestSchema: createSaleBatchRequestSchema,
        responseSchema: createSaleBatchResponseSchema
      });

      setStudio((current) => ({
        ...current,
        selectedBatchId: response.batch.id,
        selectedAllocationId: response.batch.allocations[0]?.id ?? '',
        selectedSubjectMediaId: response.batch.subjectMedia.find((item) => item.isPrimary)?.id ?? response.batch.subjectMedia[0]?.id ?? ''
      }));
      await refreshGeneratedAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatError(requestError));
    } finally {
      setCreatingSaleBatch(false);
    }
  }, [breederId, refreshGeneratedAssets, studio.batchNote, studio.plannedQuantity, studio.priceHigh, studio.priceLow, studio.selectedEggEventId]);

  const handleCreateSaleAllocation = useCallback(async () => {
    if (!breederId) {
      return;
    }

    if (!studio.selectedBatchId) {
      setAssetError('请先创建或选择一个销售批次。');
      return;
    }

    setCreatingSaleAllocation(true);

    try {
      const response = await apiRequest(`/products/${breederId}/sale-allocations`, {
        method: 'POST',
        body: {
          saleBatchId: studio.selectedBatchId,
          quantity: Number.parseInt(studio.allocationQuantity || '1', 10) || 1,
          buyerName: studio.buyerName.trim(),
          buyerAccountId: studio.buyerAccountId.trim() || null,
          buyerContact: studio.buyerContact.trim() || null,
          unitPrice: parseOptionalDecimalInput(studio.unitPrice),
          channel: studio.channel.trim() || null,
          campaignId: studio.campaignId.trim() || null,
          note: studio.allocationNote.trim() || null,
          soldAt: studio.soldAt ? new Date(studio.soldAt).toISOString() : undefined
        },
        requestSchema: createSaleAllocationRequestSchema,
        responseSchema: createSaleAllocationResponseSchema
      });

      setStudio((current) => ({
        ...current,
        selectedBatchId: response.batch.id,
        selectedAllocationId: response.allocation.id
      }));
      await refreshGeneratedAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatError(requestError));
    } finally {
      setCreatingSaleAllocation(false);
    }
  }, [
    breederId,
    refreshGeneratedAssets,
    studio.allocationNote,
    studio.allocationQuantity,
    studio.buyerAccountId,
    studio.buyerContact,
    studio.buyerName,
    studio.campaignId,
    studio.channel,
    studio.selectedBatchId,
    studio.soldAt,
    studio.unitPrice
  ]);

  const handleUploadSubjectMedia = useCallback(async () => {
    if (!breederId) {
      return;
    }

    if (!studio.selectedBatchId) {
      setAssetError('请先创建或选择一个销售批次。');
      return;
    }

    if (!studio.subjectFile) {
      setAssetError('请先选择一张主体成交图再上传。');
      return;
    }

    setUploadingSubjectMedia(true);

    try {
      const formData = new FormData();
      formData.append('saleBatchId', studio.selectedBatchId);
      formData.append('label', studio.subjectLabel.trim() || '成交主体图');
      formData.append('isPrimary', studio.subjectIsPrimary ? 'true' : 'false');
      formData.append('file', studio.subjectFile);

      const response = await apiRequest(`/products/${breederId}/sale-subject-media`, {
        method: 'POST',
        body: formData,
        responseSchema: createSaleSubjectMediaResponseSchema
      });

      setStudio((current) => ({
        ...current,
        selectedSubjectMediaId: response.media.id,
        subjectFile: null
      }));
      await refreshGeneratedAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatError(requestError));
    } finally {
      setUploadingSubjectMedia(false);
    }
  }, [breederId, refreshGeneratedAssets, studio.selectedBatchId, studio.subjectFile, studio.subjectIsPrimary, studio.subjectLabel]);

  const handlePreviewCertificate = useCallback(async () => {
    if (!breederId || !certificateRequest) {
      setAssetError('请先完成批次、客户分配和主体图选择。');
      return;
    }

    setPreviewingCertificate(true);

    try {
      const response = await apiRequest(`/products/${breederId}/certificates/preview`, {
        method: 'POST',
        body: certificateRequest,
        requestSchema: productCertificateGenerateRequestSchema,
        responseSchema: generateProductCertificatePreviewResponseSchema
      });

      setGeneratedAssets((current) => ({
        ...current,
        certificatePreview: response.preview
      }));
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatError(requestError));
    } finally {
      setPreviewingCertificate(false);
    }
  }, [breederId, certificateRequest]);

  const handleConfirmCertificate = useCallback(async () => {
    if (!breederId || !certificateRequest) {
      setAssetError('请先完成批次、客户分配和主体图选择。');
      return;
    }

    setConfirmingCertificate(true);

    try {
      await apiRequest(`/products/${breederId}/certificates/confirm`, {
        method: 'POST',
        body: certificateRequest,
        requestSchema: productCertificateGenerateRequestSchema,
        responseSchema: confirmProductCertificateGenerateResponseSchema
      });

      setGeneratedAssets((current) => ({
        ...current,
        certificatePreview: null
      }));
      await refreshGeneratedAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatError(requestError));
    } finally {
      setConfirmingCertificate(false);
    }
  }, [breederId, certificateRequest, refreshGeneratedAssets]);

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
      await refreshGeneratedAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatError(requestError));
    } finally {
      setGeneratingCouplePhoto(false);
    }
  }, [breederId, refreshGeneratedAssets]);

  return (
    <main className="space-y-4 pb-10 sm:space-y-6">
      <Card className="tenant-card-lift overflow-hidden rounded-3xl border-neutral-200/90 bg-white transition-all">
        <CardContent className="grid gap-6 p-0 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="relative bg-neutral-100">
            <button
              type="button"
              onClick={() => router.push(listHref)}
              className="absolute left-3 top-3 z-10 inline-flex h-9 items-center gap-1 rounded-full border border-white/40 bg-black/55 px-3 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] backdrop-blur-sm transition hover:bg-black/65"
              aria-label="返回列表"
            >
              <ArrowLeft size={14} />
              返回
            </button>
            {activeImage ? (
              <img src={resolveImageUrl(activeImage.url)} alt={`${data.breeder?.code ?? 'breeder'} 图片`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center text-neutral-400">
                <ImageIcon size={42} />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4">
              <p className="text-sm font-semibold text-white">{currentBreeder?.code ?? '种龟详情'}</p>
              <p className="text-xs text-white/85">{currentBreeder?.name ?? '未命名种龟'}</p>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={currentBreeder?.inStock ? 'success' : 'default'}>
                {currentBreeder?.inStock ? '启用中' : '停用'}
              </Badge>
              <Badge variant="accent">{formatSex(currentBreeder?.sex, { unknownLabel: 'unknown' })}</Badge>
              <Badge variant="sky">{currentBreeder?.seriesId ?? '未关联系列'}</Badge>
            </div>
            <div>
              <CardTitle className="text-4xl text-neutral-900">{currentBreeder?.code ?? '种龟详情'}</CardTitle>
              <CardDescription className="mt-2 text-base text-neutral-600">{currentBreeder?.description ?? '暂无描述'}</CardDescription>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetaItem label="父本" value={currentBreeder?.sireCode ?? '未关联'} />
              <MetaItem label="母本" value={currentBreeder?.damCode ?? '未关联'} />
              <MetaItem label="配偶" value={currentBreeder?.mateCode ?? '未关联'} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => router.push(listHref)}>
                返回列表
              </Button>
              {currentBreeder ? (
                <Button variant="primary" onClick={() => setIsEditDrawerOpen(true)}>
                  <PencilRuler size={16} />
                  编辑资料
                </Button>
              ) : null}
              {currentBreeder ? (
                <Button variant="secondary" onClick={() => router.push(`/app/${tenantSlug}/products/${currentBreeder.id}`)}>
                  图片管理
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
          <p className="text-sm text-neutral-600">正在加载种龟、事件和家族树数据...</p>
        </Card>
      ) : null}

      {!loading && data.images.length > 0 ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ImageIcon size={18} />
              图片预览
            </CardTitle>
            <CardDescription>点击缩略图即可切换大图，排序与主图请在产品图片管理页操作。</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
            {data.images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImageId(image.id)}
                className={`overflow-hidden rounded-2xl border transition-all ${
                  image.id === (activeImage?.id ?? '')
                    ? 'border-[#FFD400] shadow-[0_6px_20px_rgba(255,212,0,0.25)]'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <img src={resolveImageUrl(image.url)} alt="种龟缩略图" className="h-24 w-full object-cover" />
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!loading ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="text-2xl">证书与夫妻照</CardTitle>
            <CardDescription>证书按租户每月 100 张配额控制；夫妻照不限，归属母龟资产。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assetError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {assetError}
              </p>
            ) : null}

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[28px] border border-neutral-900 bg-neutral-950 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
                <div className="grid gap-6 bg-[radial-gradient(circle_at_top_left,_rgba(255,212,0,0.2),_transparent_42%),linear-gradient(135deg,_rgba(255,255,255,0.04),_transparent_52%)] px-5 py-5 text-white lg:grid-cols-[1.2fr_0.8fr] lg:px-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">
                      <Gem size={14} />
                      Certificate Studio
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-semibold leading-tight">成交后发证，批次绑定生蛋事件，主体图独立归档。</h3>
                      <p className="max-w-2xl text-sm leading-6 text-white/70">
                        先锁定生蛋事件和父本快照，再登记客户分配与成交主体图，最后生成带验真二维码的收藏证书；夫妻照继续作为朋友圈售种物料使用。
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Quota</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{certificateEligibility?.quota.remaining ?? 0}</p>
                      <p className="text-xs text-white/60">本月剩余 / {certificateEligibility?.quota.limit ?? 100}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Batch</p>
                      <p className="mt-2 truncate text-lg font-semibold text-white">{selectedBatch?.batchNo ?? '未选择'}</p>
                      <p className="text-xs text-white/60">剩余 {selectedBatch?.remainingQuantity ?? 0} / {selectedBatch?.plannedQuantity ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Subject</p>
                      <p className="mt-2 text-lg font-semibold text-white">{selectedSubjectMedia ? '已绑定' : '待上传'}</p>
                      <p className="text-xs text-white/60">成交主体图 {selectedSubjectMedia ? '可预览' : '将出现在证书中央'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 01</p>
                        <h3 className="mt-1 text-lg font-semibold text-neutral-900">锁定销售批次</h3>
                        <p className="mt-1 text-sm text-neutral-500">一张证书必须绑定一个生蛋事件，一个事件可以拆分成多个客户分配。</p>
                      </div>
                      <Badge className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">父本按事件锁定</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>生蛋事件</Label>
                        <NativeSelect
                          value={studio.selectedEggEventId}
                          onChange={(event) => {
                            const nextEggEventId = event.target.value;
                            const matchedBatch = saleBatches.find((batch) => batch.eggEventId === nextEggEventId) ?? null;
                            setStudio((current) => ({
                              ...current,
                              selectedEggEventId: nextEggEventId,
                              selectedBatchId: matchedBatch?.id ?? '',
                              selectedAllocationId: matchedBatch?.allocations[0]?.id ?? '',
                              selectedSubjectMediaId:
                                matchedBatch?.subjectMedia.find((item) => item.isPrimary)?.id ?? matchedBatch?.subjectMedia[0]?.id ?? ''
                            }));
                          }}
                        >
                          <option value="">请选择生蛋事件</option>
                          {eggEvents.map((event) => (
                            <option key={event.id} value={event.id}>
                              {eggEventOptionLabels.get(event.id) ?? `${formatEventShortDate(event.eventDate)} · ${buildEventSummary(event)}`}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="space-y-2">
                        <Label>销售批次</Label>
                        <NativeSelect
                          value={studio.selectedBatchId}
                          onChange={(event) => {
                            const nextBatch = saleBatches.find((batch) => batch.id === event.target.value) ?? null;
                            setStudio((current) => ({
                              ...current,
                              selectedEggEventId: nextBatch?.eggEventId ?? current.selectedEggEventId,
                              selectedBatchId: nextBatch?.id ?? '',
                              selectedAllocationId: nextBatch?.allocations[0]?.id ?? '',
                              selectedSubjectMediaId:
                                nextBatch?.subjectMedia.find((item) => item.isPrimary)?.id ?? nextBatch?.subjectMedia[0]?.id ?? ''
                            }));
                          }}
                        >
                          <option value="">新建或选择批次</option>
                          {saleBatches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.batchNo} · 剩余 {batch.remainingQuantity}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="space-y-2">
                        <Label>计划数量</Label>
                        <Input
                          type="number"
                          min={1}
                          value={studio.plannedQuantity}
                          onChange={(event) => setStudio((current) => ({ ...current, plannedQuantity: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>价格下限</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="如 1999"
                          value={studio.priceLow}
                          onChange={(event) => setStudio((current) => ({ ...current, priceLow: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>价格上限</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="如 2888"
                          value={studio.priceHigh}
                          onChange={(event) => setStudio((current) => ({ ...current, priceHigh: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>批次备注</Label>
                        <Textarea
                          value={studio.batchNote}
                          onChange={(event) => setStudio((current) => ({ ...current, batchNote: event.target.value }))}
                          placeholder="记录这一窝的亮点、留种比例、发朋友圈角度等。"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-3">
                      <div className="space-y-1 text-sm text-neutral-600">
                        <p className="font-semibold text-neutral-900">{selectedBatch?.batchNo ?? '尚未创建批次'}</p>
                        <p>
                          父本快照：{selectedBatch?.sireCodeSnapshot ?? '未锁定'} · 事件时间：
                          {selectedBatch ? formatDateShort(selectedBatch.eventDateSnapshot) : '待绑定'}
                        </p>
                      </div>
                      <Button variant="primary" onClick={() => void handleCreateSaleBatch()} disabled={!studio.selectedEggEventId || creatingSaleBatch}>
                        {creatingSaleBatch ? '批次生成中...' : selectedBatch ? '按当前事件同步批次' : '创建销售批次'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 02</p>
                        <h3 className="mt-1 text-lg font-semibold text-neutral-900">登记成交分配</h3>
                        <p className="mt-1 text-sm text-neutral-500">一窝可拆多次成交，每次生成证书都会扣减月配额。</p>
                      </div>
                      <Badge className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">可用于补发重开</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>客户分配</Label>
                        <NativeSelect
                          value={studio.selectedAllocationId}
                          onChange={(event) => setStudio((current) => ({ ...current, selectedAllocationId: event.target.value }))}
                          disabled={!selectedBatch}
                        >
                          <option value="">请选择或先新增成交分配</option>
                          {selectedBatch?.allocations.map((allocation) => (
                            <option key={allocation.id} value={allocation.id}>
                              {allocation.allocationNo} · {allocation.buyerName} · {allocation.quantity} 只
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="space-y-2">
                        <Label>买家名称</Label>
                        <Input value={studio.buyerName} onChange={(event) => setStudio((current) => ({ ...current, buyerName: event.target.value }))} placeholder="如：张先生 / 深圳龟友会" />
                      </div>
                      <div className="space-y-2">
                        <Label>买家账号</Label>
                        <Input value={studio.buyerAccountId} onChange={(event) => setStudio((current) => ({ ...current, buyerAccountId: event.target.value }))} placeholder="微信号 / 小红书号" />
                      </div>
                      <div className="space-y-2">
                        <Label>联系方式</Label>
                        <Input value={studio.buyerContact} onChange={(event) => setStudio((current) => ({ ...current, buyerContact: event.target.value }))} placeholder="手机号 / 备注联系信息" />
                      </div>
                      <div className="space-y-2">
                        <Label>成交数量</Label>
                        <Input type="number" min={1} value={studio.allocationQuantity} onChange={(event) => setStudio((current) => ({ ...current, allocationQuantity: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>单价</Label>
                        <Input inputMode="decimal" placeholder="如 2680" value={studio.unitPrice} onChange={(event) => setStudio((current) => ({ ...current, unitPrice: event.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>成交渠道</Label>
                        <Input value={studio.channel} onChange={(event) => setStudio((current) => ({ ...current, channel: event.target.value }))} placeholder="朋友圈 / 私聊 / 直播" />
                      </div>
                      <div className="space-y-2">
                        <Label>活动标识</Label>
                        <Input value={studio.campaignId} onChange={(event) => setStudio((current) => ({ ...current, campaignId: event.target.value }))} placeholder="如 spring-2026" />
                      </div>
                      <div className="space-y-2">
                        <Label>成交时间</Label>
                        <Input type="datetime-local" value={studio.soldAt} onChange={(event) => setStudio((current) => ({ ...current, soldAt: event.target.value }))} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>成交备注</Label>
                        <Textarea value={studio.allocationNote} onChange={(event) => setStudio((current) => ({ ...current, allocationNote: event.target.value }))} placeholder="例如：已收定金、是否包邮、是否老客户返单。" />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3">
                      <div className="space-y-1 text-sm text-neutral-600">
                        <p className="font-semibold text-neutral-900">{selectedAllocation?.allocationNo ?? '尚未绑定客户分配'}</p>
                        <p>
                          买家：{selectedAllocation?.buyerName ?? '待登记'} · 渠道：{selectedAllocation?.channel ?? '待登记'} · 数量：{selectedAllocation?.quantity ?? 0}
                        </p>
                      </div>
                      <Button variant="secondary" onClick={() => void handleCreateSaleAllocation()} disabled={!selectedBatch || !studio.buyerName.trim() || creatingSaleAllocation}>
                        {creatingSaleAllocation ? '登记中...' : '新增成交分配'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">Step 03</p>
                        <h3 className="mt-1 text-lg font-semibold text-neutral-900">上传成交主体图</h3>
                        <p className="mt-1 text-sm text-neutral-500">主体图会出现在证书主视觉区域，也可作为未来补发重开的默认素材。</p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                        <Camera size={14} />
                        商家水印
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>主体图记录</Label>
                        <NativeSelect
                          value={studio.selectedSubjectMediaId}
                          onChange={(event) => setStudio((current) => ({ ...current, selectedSubjectMediaId: event.target.value }))}
                          disabled={!selectedBatch}
                        >
                          <option value="">请选择或先上传主体图</option>
                          {selectedBatch?.subjectMedia.map((media) => (
                            <option key={media.id} value={media.id}>
                              {media.label ?? '未命名主体图'}{media.isPrimary ? ' · 主图' : ''}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="space-y-2">
                        <Label>图片标签</Label>
                        <Input value={studio.subjectLabel} onChange={(event) => setStudio((current) => ({ ...current, subjectLabel: event.target.value }))} placeholder="如：3月成交主体 / 腹甲特写" />
                      </div>
                      <div className="space-y-2">
                        <Label>上传新图</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const nextFile = event.target.files?.[0] ?? null;
                            setStudio((current) => ({ ...current, subjectFile: nextFile }));
                          }}
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                        <label className="inline-flex items-center gap-2 font-medium text-neutral-700">
                          <input
                            type="checkbox"
                            checked={studio.subjectIsPrimary}
                            onChange={(event) => setStudio((current) => ({ ...current, subjectIsPrimary: event.target.checked }))}
                          />
                          设为该批次默认主体图
                        </label>
                        <Button variant="secondary" onClick={() => void handleUploadSubjectMedia()} disabled={!selectedBatch || !studio.subjectFile || uploadingSubjectMedia}>
                          {uploadingSubjectMedia ? '上传中...' : '上传主体图'}
                        </Button>
                      </div>
                    </div>
                    {selectedSubjectMedia ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                        <img src={resolveImageUrl(selectedSubjectMedia.contentPath)} alt={selectedSubjectMedia.label ?? '主体图'} className="h-52 w-full object-cover" />
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-neutral-600">
                          <div>
                            <p className="font-semibold text-neutral-900">{selectedSubjectMedia.label ?? '成交主体图'}</p>
                            <p>{selectedSubjectMedia.isPrimary ? '当前默认图' : '备用主体图'} · {formatDateShort(selectedSubjectMedia.createdAt)}</p>
                          </div>
                          <Badge className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700 shadow-sm">{selectedSubjectMedia.sizeBytes} bytes</Badge>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-neutral-500">上传一张专门拍摄的成交主体图，证书会更有“电子发票 + 藏品凭证”的质感。</p>
                    )}
                  </div>
                </div>

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
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-6 text-amber-700">
                        {certificateEligibility.reasons.join('；')}
                      </div>
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
                      <Button variant="secondary" disabled={!canPreviewCertificate || previewingCertificate} onClick={() => void handlePreviewCertificate()}>
                        {previewingCertificate ? '生成预览中...' : '预览证书'}
                      </Button>
                      <Button variant="primary" disabled={!canConfirmCertificate || confirmingCertificate} onClick={() => void handleConfirmCertificate()}>
                        {confirmingCertificate ? '确认生成中...' : '生成正式证书'}
                      </Button>
                      <Button variant="outline" onClick={() => router.push(`/app/${tenantSlug}/certificates`)}>
                        <Stamp size={14} />
                        打开证书中心
                      </Button>
                    </div>
                    {generatedAssets.certificatePreview ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 text-xs text-neutral-600">
                          <span>{generatedAssets.certificatePreview.certNo}</span>
                          <span>验真 ID: {generatedAssets.certificatePreview.verifyId}</span>
                        </div>
                        <img
                          src={`data:${generatedAssets.certificatePreview.mimeType};base64,${generatedAssets.certificatePreview.imageBase64}`}
                          alt="证书预览"
                          className="w-full"
                        />
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
                      <Badge className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">已出证 {generatedAssets.certificates.length}</Badge>
                    </div>
                    {generatedAssets.certificates.length > 0 ? (
                      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(138px,1fr))] gap-3">
                        {generatedAssets.certificates.slice(0, 6).map((certificate) => (
                          <div key={certificate.id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                            <img src={resolveImageUrl(certificate.contentPath)} alt={certificate.certNo} className="h-24 w-full object-cover" />
                            <div className="space-y-1 px-3 py-3">
                              <p className="truncate text-xs font-semibold text-neutral-900">{certificate.certNo}</p>
                              <p className="text-[11px] text-neutral-500">版本 V{certificate.versionNo} · {formatDateShort(certificate.issuedAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-neutral-500">暂无证书记录。</p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-900">母龟夫妻照</h3>
                        <p className="mt-1 text-sm text-neutral-500">手动生成，用于朋友圈广告和售种前预热。</p>
                      </div>
                      <Button variant="primary" disabled={!isFemaleBreeder || generatingCouplePhoto} onClick={() => void handleGenerateCouplePhoto()}>
                        {generatingCouplePhoto ? '生成中...' : '生成夫妻照'}
                      </Button>
                    </div>
                    {!isFemaleBreeder ? <p className="mt-3 text-xs text-neutral-500">仅母龟可以生成夫妻照。</p> : null}
                    {generatedAssets.currentCouplePhoto ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                        <img src={resolveImageUrl(generatedAssets.currentCouplePhoto.contentPath)} alt="当前夫妻照" className="h-64 w-full object-cover" />
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-neutral-600">
                          <p className="font-semibold text-neutral-900">
                            {generatedAssets.currentCouplePhoto.femaleCodeSnapshot} × {generatedAssets.currentCouplePhoto.maleCodeSnapshot}
                          </p>
                          <p>{formatDateShort(generatedAssets.currentCouplePhoto.generatedAt)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-neutral-500">暂无当前夫妻照。</p>
                    )}
                    {generatedAssets.couplePhotoHistory.length > 0 ? (
                      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                        {generatedAssets.couplePhotoHistory.slice(0, 6).map((photo) => (
                          <div key={photo.id} className="space-y-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-2">
                            <img src={resolveImageUrl(photo.contentPath)} alt={`${photo.femaleCodeSnapshot}-${photo.maleCodeSnapshot}`} className="h-20 w-full rounded-xl object-cover" />
                            <p className="truncate text-[11px] font-semibold text-neutral-800">{photo.femaleCodeSnapshot} × {photo.maleCodeSnapshot}</p>
                            <p className="text-[10px] text-neutral-500">{formatDateShort(photo.generatedAt)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && data.tree ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Network size={18} />
              家族谱系
            </CardTitle>
            <CardDescription>{data.tree.limitations}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
              <div className="overflow-x-auto overflow-y-hidden pb-4">
                <div className="inline-flex gap-8 px-4 py-6">
                  <div className="flex flex-col gap-3">
                    <div className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">父本 / 母本</div>
                    <TreeCard title="父本" node={data.tree.sire} onOpen={openBreederDetail} />
                    <TreeCard title="母本" node={data.tree.dam} onOpen={openBreederDetail} />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="text-center text-xs font-medium text-amber-600 dark:text-amber-400">当前个体 / 配偶</div>
                    <TreeCard title="当前个体" node={data.tree.self} onOpen={openBreederDetail} highlight />
                    <TreeCard title="配偶" node={data.tree.mate} onOpen={openBreederDetail} />
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400">子代</div>
                    {data.tree.children.length === 0 ? (
                      <TreeCard title="子代" node={null} onOpen={openBreederDetail} />
                    ) : (
                      data.tree.children.map((child) => (
                        <TreeCard
                          key={child.id}
                          title={formatSex(child.sex, { unknownLabel: 'unknown' })}
                          node={child}
                          onOpen={openBreederDetail}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                <div className="rounded-t-lg bg-black/60 px-4 py-1.5 text-[11px] text-white backdrop-blur-sm">左右滑动查看完整谱系</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading ? (
        <Card className="tenant-card-lift rounded-3xl border-neutral-200/90 bg-white transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CalendarClock size={18} />
              种龟事件
            </CardTitle>
            <CardDescription>交配、产蛋、换公等记录，与分享页展示一致。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.events.length === 0 ? (
              <p className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-6 text-center text-sm text-neutral-500 dark:border-white/10 dark:bg-neutral-950/40 dark:text-neutral-400">
                暂无事件记录。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {EVENT_FILTER_OPTIONS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setEventFilter(item.key)}
                      className={buildInteractivePillClass(eventFilter === item.key, {
                        activeClassName:
                          'border-neutral-900 bg-neutral-900 text-white dark:border-white/15 dark:bg-neutral-50 dark:text-neutral-950',
                        idleClassName:
                          'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20'
                      })}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white p-3 shadow-[0_6px_18px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-900/75">
                  <div className="flex w-max flex-row items-center gap-2">
                    {filteredEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white px-2 py-2.5 shadow-sm dark:border-white/10 dark:bg-neutral-950/40"
                      >
                        <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
                        <span className="text-[10px] font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
                          {formatEventShortDate(event.eventDate)}
                        </span>
                        <span className="text-[10px] font-semibold leading-tight text-neutral-600 dark:text-neutral-300">
                          {eventTypeLabel(event.eventType)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-neutral-900/75">
                  <div className="border-b bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-950/35">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">记录（已加载 {filteredEvents.length} 条）</div>
                      <button
                        type="button"
                        onClick={() => setEventExpanded((current) => !current)}
                        className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 dark:border-white/10 dark:bg-neutral-950/30 dark:text-neutral-200 dark:hover:border-white/20"
                      >
                        {eventExpanded ? '收起' : '展开'}
                      </button>
                    </div>
                  </div>
                  {eventExpanded ? (
                    filteredEvents.length === 0 ? (
                      <div className="p-6 text-sm text-neutral-500 dark:text-neutral-400">暂无记录</div>
                    ) : (
                      <div>
                        {groupedEvents.map((group) => (
                          <div key={group.year}>
                            <div className="border-b border-neutral-200/80 px-4 py-2 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-neutral-300">
                              {group.year}
                            </div>
                            <div className="divide-y dark:divide-white/10">
                              {group.items.map((event) => (
                                <div key={event.id} className="px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm leading-none">{eventTypeIcon(event.eventType)}</span>
                                    <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{eventTypeLabel(event.eventType)}</span>
                                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{formatEventShortDate(event.eventDate)}</span>
                                  </div>
                                  <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{eventDetailLabels.get(event.id) ?? buildEventSummary(event)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function TreeCard(props: { title: string; node: FamilyTreeNode | null; onOpen: (id: string) => void; highlight?: boolean }) {
  const node = props.node;

  return (
    <div
      className={cn(
        'w-28 rounded-2xl border bg-white p-3 shadow-[0_6px_16px_rgba(0,0,0,0.08)] transition hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)] dark:bg-neutral-900/70',
        props.highlight
          ? 'border-amber-300 ring-2 ring-amber-200/70 dark:border-amber-400/80 dark:ring-amber-400/20'
          : 'border-neutral-200/90 dark:border-white/10'
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 dark:text-neutral-400">{props.title}</p>
      {node ? (
        <div className="mt-2 space-y-1.5">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">{node.code}</p>
          <p className="line-clamp-2 min-h-8 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">{node.name ?? '未命名种龟'}</p>
          <div className="pt-1">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 rounded-full border border-neutral-200 px-2.5 text-[11px] font-semibold dark:border-white/10 dark:bg-neutral-950/35 dark:text-neutral-100"
              onClick={() => props.onOpen(node.id)}
            >
              打开
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">未关联</p>
      )}
    </div>
  );
}


function buildLocalDateTimeValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseOptionalDecimalInput(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`金额格式无效：${value}`);
  }

  return parsed;
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-2.5 py-2 text-center font-semibold',
        ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 bg-white text-neutral-500'
      )}
    >
      {label}: {ok ? '通过' : '未满足'}
    </div>
  );
}

function resolveImageUrl(value: string) {
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

function eventTypeLabel(eventType: string) {
  if (eventType === 'mating') return '交配';
  if (eventType === 'egg') return '产蛋';
  if (eventType === 'change_mate') return '换公';
  return eventType;
}

function eventTypeIcon(eventType: string) {
  if (eventType === 'mating') return '🔞';
  if (eventType === 'egg') return '🥚';
  if (eventType === 'change_mate') return '🔁';
  return '•';
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

function formatEventYear(isoDate: string) {
  const d = new Date(isoDate);
  return String(d.getFullYear());
}

function formatDateShort(isoDate: string) {
  const d = new Date(isoDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type EventCollisionMeta = {
  duplicateCount: number;
  duplicateIndex: number;
};

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

function buildEventDetailLabel(event: ProductEvent, collision?: EventCollisionMeta) {
  const baseLabel = buildEventSummary(event);
  if (!collision || collision.duplicateCount <= 1) {
    return baseLabel;
  }

  return `${baseLabel} · 录入 ${formatEventClock(event.createdAt)}`;
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
