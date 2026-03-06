'use client';

import { useCallback, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import type { CertificateStudioState } from '@/components/certificate-studio/types';
import {
  createSaleBatchRequestSchema,
  createSaleBatchResponseSchema,
  createSaleAllocationRequestSchema,
  createSaleAllocationResponseSchema,
  createSaleSubjectMediaResponseSchema,
  productCertificateGenerateRequestSchema,
  generateProductCertificatePreviewResponseSchema,
  confirmProductCertificateGenerateResponseSchema
} from '@eggturtle/shared';
import type { ProductCertificateGenerateRequest, ProductCertificatePreview } from '@eggturtle/shared';

interface UseCertificateStudioParams {
  breederId: string | null;
  studio: CertificateStudioState;
  setStudio: React.Dispatch<React.SetStateAction<CertificateStudioState>>;
  certificateRequest: ProductCertificateGenerateRequest | null;
  onRefreshAssets: () => Promise<void>;
  onPreviewGenerated: (preview: ProductCertificatePreview) => void;
  onPreviewCleared: () => void;
}

export function useCertificateStudio({
  breederId,
  studio,
  setStudio,
  certificateRequest,
  onRefreshAssets,
  onPreviewGenerated,
  onPreviewCleared
}: UseCertificateStudioParams) {
  const [assetError, setAssetError] = useState<string | null>(null);
  const [creatingSaleBatch, setCreatingSaleBatch] = useState(false);
  const [creatingSaleAllocation, setCreatingSaleAllocation] = useState(false);
  const [uploadingSubjectMedia, setUploadingSubjectMedia] = useState(false);
  const [previewingCertificate, setPreviewingCertificate] = useState(false);
  const [confirmingCertificate, setConfirmingCertificate] = useState(false);

  const handleCreateSaleBatch = useCallback(async () => {
    if (!breederId) {
      return;
    }

    if (!studio.selectedEggEventId) {
      setAssetError('请先选择一个生蛋事件。');
      return;
    }

    setCreatingSaleBatch(true);

    try {
      const response = await apiRequest(`/products/${breederId}/sale-batches`, {
        method: 'POST',
        body: {
          eggEventId: studio.selectedEggEventId,
          plannedQuantity: Number(studio.plannedQuantity) || 1,
          priceLow: studio.priceLow.trim() ? Number(studio.priceLow) : undefined,
          priceHigh: studio.priceHigh.trim() ? Number(studio.priceHigh) : undefined,
          note: studio.batchNote.trim() || undefined
        },
        requestSchema: createSaleBatchRequestSchema,
        responseSchema: createSaleBatchResponseSchema
      });

      setStudio((current) => ({
        ...current,
        selectedBatchId: response.batch.id
      }));
      await onRefreshAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatApiError(requestError));
    } finally {
      setCreatingSaleBatch(false);
    }
  }, [breederId, onRefreshAssets, studio.batchNote, studio.plannedQuantity, studio.priceLow, studio.priceHigh, studio.selectedEggEventId, setStudio]);

  const handleCreateSaleAllocation = useCallback(async () => {
    if (!breederId) {
      return;
    }

    if (!studio.selectedBatchId) {
      setAssetError('请先创建或选择一个销售批次。');
      return;
    }

    if (!studio.buyerName.trim()) {
      setAssetError('请填写买家名称。');
      return;
    }

    setCreatingSaleAllocation(true);

    try {
      const response = await apiRequest(`/products/${breederId}/sale-allocations`, {
        method: 'POST',
        body: {
          saleBatchId: studio.selectedBatchId,
          buyerName: studio.buyerName.trim(),
          buyerAccountId: studio.buyerAccountId.trim() || undefined,
          buyerContact: studio.buyerContact.trim() || undefined,
          quantity: Number(studio.allocationQuantity) || 1,
          unitPrice: studio.unitPrice.trim() ? Number(studio.unitPrice) : undefined,
          channel: studio.channel.trim() || undefined,
          campaignId: studio.campaignId.trim() || undefined,
          soldAt: studio.soldAt ? new Date(studio.soldAt).toISOString() : undefined,
          note: studio.allocationNote.trim() || undefined
        },
        requestSchema: createSaleAllocationRequestSchema,
        responseSchema: createSaleAllocationResponseSchema
      });

      setStudio((current) => ({
        ...current,
        selectedAllocationId: response.allocation.id
      }));
      await onRefreshAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatApiError(requestError));
    } finally {
      setCreatingSaleAllocation(false);
    }
  }, [
    breederId,
    onRefreshAssets,
    studio.allocationNote,
    studio.allocationQuantity,
    studio.buyerAccountId,
    studio.buyerContact,
    studio.buyerName,
    studio.campaignId,
    studio.channel,
    studio.selectedBatchId,
    studio.soldAt,
    studio.unitPrice,
    setStudio
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
      await onRefreshAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatApiError(requestError));
    } finally {
      setUploadingSubjectMedia(false);
    }
  }, [breederId, onRefreshAssets, studio.selectedBatchId, studio.subjectFile, studio.subjectIsPrimary, studio.subjectLabel, setStudio]);

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

      onPreviewGenerated(response.preview);
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatApiError(requestError));
    } finally {
      setPreviewingCertificate(false);
    }
  }, [breederId, certificateRequest, onPreviewGenerated]);

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

      onPreviewCleared();
      await onRefreshAssets();
      setAssetError(null);
    } catch (requestError) {
      setAssetError(formatApiError(requestError));
    } finally {
      setConfirmingCertificate(false);
    }
  }, [breederId, certificateRequest, onRefreshAssets, onPreviewCleared]);

  return {
    assetError,
    setAssetError,
    creatingSaleBatch,
    creatingSaleAllocation,
    uploadingSubjectMedia,
    previewingCertificate,
    confirmingCertificate,
    handleCreateSaleBatch,
    handleCreateSaleAllocation,
    handleUploadSubjectMedia,
    handlePreviewCertificate,
    handleConfirmCertificate
  };
}
