/* eslint-disable @next/next/no-img-element */
'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  createProductEventRequestSchema,
  createProductEventResponseSchema,
  deleteProductEventResponseSchema,
  deleteProductImageResponseSchema,
  getProductResponseSchema,
  listProductEventsResponseSchema,
  listProductImagesResponseSchema,
  reorderProductImagesRequestSchema,
  reorderProductImagesResponseSchema,
  setMainProductImageResponseSchema,
  updateProductEventRequestSchema,
  updateProductEventResponseSchema,
  updateProductRequestSchema,
  uploadProductImageResponseSchema,
  type CreateProductEventRequest,
  type Product,
  type ProductEvent,
  type ProductImage,
  type UpdateProductEventRequest
} from '@eggturtle/shared';
import {
  Loader2,
  X
} from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { markProductsPageDirty } from '@/lib/products-page-cache';
import ProductEditBasicInfoSection from '@/components/product-drawer/product-edit-basic-info-section';
import ProductEventDraftSection from '@/components/product-drawer/product-event-draft-section';
import ProductEventEditDialog from '@/components/product-drawer/product-event-edit-dialog';
import ProductEventHistorySection from '@/components/product-drawer/product-event-history-section';
import {
  buildUpdateEventPayload,
  formatEventDateLabel,
  formatEventTypeLabel,
  isEditableEventType,
  sortProductEvents,
  toDefaultEventFormState,
  toDemoProductEvent,
  toDemoUpdatedProductEvent,
  toProductEventEditFormState,
  type EventTypeQuickFilter,
  type ProductEventEditFormState,
  type ProductEventEntryType,
  type ProductEventFormState,
} from '@/components/product-drawer/event-shared';
import { uploadSingleFileWithAuth } from '@/lib/upload-client';
import ProductEditImageWorkbench from '@/components/product-drawer/edit-image-workbench';
import { createDemoDrawerImages } from '@/components/product-drawer/image-utils';
import {
  createSeriesIfNeeded,
  normalizeOptionalCode,
  parseOffspringUnitPrice,
  type RelationCodeFieldKey,
  type ProductSeriesOption
} from '@/components/product-drawer/shared';
import { useProductSeriesManagement } from '@/components/product-drawer/use-product-series-management';
import { useRelationCodeSuggestions } from '@/components/product-drawer/use-relation-code-suggestions';
import { Button } from '@/components/ui/button';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';
import { buildInteractivePillClass } from '@/components/ui/pill';

type ProductEditFormState = {
  code: string;
  description: string;
  seriesId: string;
  sex: '' | 'male' | 'female';
  offspringUnitPrice: string;
  sireCode: string;
  damCode: string;
  mateCode: string;
  excludeFromBreeding: boolean;
  hasSample: boolean;
  inStock: boolean;
  isFeatured: boolean;
};
type EditDrawerModule = 'basic' | 'breeding' | 'images';

type ProductEditDrawerProps = {
  open: boolean;
  product: Product | null;
  tenantSlug: string;
  isDemoMode: boolean;
  seriesOptions?: ProductSeriesOption[];
  onClose: () => void;
  onSaved: (product: Product, createdEvent?: ProductEvent) => void;
  onSeriesCreated?: (series: ProductSeriesOption) => void;
};

export default function ProductEditDrawer({
  open,
  product,
  tenantSlug,
  isDemoMode,
  seriesOptions,
  onClose,
  onSaved,
  onSeriesCreated
}: ProductEditDrawerProps) {
  const [form, setForm] = useState<ProductEditFormState>(toProductEditFormState(product));
  const [eventForm, setEventForm] = useState<ProductEventFormState>(toDefaultEventFormState());
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [submittingImages, setSubmittingImages] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageMessage, setImageMessage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [events, setEvents] = useState<ProductEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [submittingEventAction, setSubmittingEventAction] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ProductEvent | null>(null);
  const [eventEditForm, setEventEditForm] = useState<ProductEventEditFormState | null>(null);
  const [eventSectionCollapsed, setEventSectionCollapsed] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<EventTypeQuickFilter>('all');
  const [eventKeywordFilter, setEventKeywordFilter] = useState('');
  const [activeModule, setActiveModule] = useState<EditDrawerModule>('basic');
  const [error, setError] = useState<string | null>(null);
  const {
    seriesOptions: resolvedSeriesOptions,
    loadingSeries,
    isCreatingSeries,
    setIsCreatingSeries,
    newSeriesCode,
    setNewSeriesCode,
    newSeriesName,
    setNewSeriesName,
    newSeriesDescription,
    setNewSeriesDescription,
    newSeriesSortOrder,
    setNewSeriesSortOrder,
    newSeriesIsActive,
    setNewSeriesIsActive,
    resetSeriesDraft,
    appendSeriesOption,
  } = useProductSeriesManagement({
    open,
    isDemoMode,
    initialOptions: seriesOptions ?? [],
    shouldLoadRemote: Boolean(product) && (seriesOptions?.length ?? 0) === 0,
    onError: setError,
  });
  const relationCodeSuggestions = useRelationCodeSuggestions({
    open,
    isDemoMode,
    productId: product?.id,
    values: {
      sireCode: form.sireCode,
      damCode: form.damCode,
      mateCode: form.mateCode,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(toProductEditFormState(product));
    setIsCreatingSeries(false);
    resetSeriesDraft();
    setEventForm(toDefaultEventFormState());
    setEvents([]);
    setEventError(null);
    setEventMessage(null);
    setEditingEvent(null);
    setEventEditForm(null);
    setEventSectionCollapsed(false);
    setEventTypeFilter('all');
    setEventKeywordFilter('');
    setActiveModule('basic');
    setError(null);
  }, [open, product, resetSeriesDraft, setIsCreatingSeries]);

  useEffect(() => {
    if (!open || !product) {
      return;
    }

    let cancelled = false;
    setImageError(null);
    setImageMessage(null);
    setCurrentImageIndex(0);

    if (isDemoMode) {
      setLoadingImages(false);
      setImages(createDemoDrawerImages(product.id));
      return;
    }

    setLoadingImages(true);
    void (async () => {
      try {
        const response = await apiRequest(`/products/${product.id}/images`, {
          responseSchema: listProductImagesResponseSchema
        });

        if (!cancelled) {
          setImages(response.images);
        }
      } catch (requestError) {
        if (!cancelled) {
          setImageError(formatApiError(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoadingImages(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, open, product]);

  useEffect(() => {
    if (!open || !product) {
      return;
    }

    let cancelled = false;
    setEventError(null);
    setEventMessage(null);
    setEditingEvent(null);
    setEventEditForm(null);

    if (isDemoMode) {
      setLoadingEvents(false);
      setEvents([]);
      return;
    }

    setLoadingEvents(true);
    void (async () => {
      try {
        const response = await apiRequest(`/products/${product.id}/events`, {
          responseSchema: listProductEventsResponseSchema
        });

        if (!cancelled) {
          setEvents(sortProductEvents(response.events));
        }
      } catch (requestError) {
        if (!cancelled) {
          setEventError(formatApiError(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoadingEvents(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, open, product]);

  useEffect(() => {
    if (images.length === 0) {
      setCurrentImageIndex(0);
      return;
    }

    if (currentImageIndex > images.length - 1) {
      setCurrentImageIndex(images.length - 1);
    }
  }, [currentImageIndex, images.length]);

  useEffect(() => {
    if (form.sex === 'female') {
      return;
    }

    setEventForm((current) => {
      if (current.eventType === 'none') {
        return current;
      }

      return toDefaultEventFormState();
    });
  }, [form.sex]);

  const canRecordEvent = useMemo(() => form.sex === 'female', [form.sex]);
  const currentImage = useMemo(
    () => images[currentImageIndex] ?? images[0] ?? null,
    [currentImageIndex, images]
  );
  const moduleTabs: Array<{ key: EditDrawerModule; label: string }> = useMemo(
    () => [
      { key: 'basic', label: '基础' },
      { key: 'breeding', label: '繁殖' },
      { key: 'images', label: '图片' }
    ],
    []
  );

  if (!open || !product) {
    return null;
  }

  function closeDrawer() {
    if (submitting || submittingImages || submittingEventAction) {
      return;
    }

    onClose();
  }

  function setFormRelationCode(field: RelationCodeFieldKey, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateEventForm(patch: Partial<ProductEventFormState>) {
    setEventForm((current) => ({
      ...current,
      ...patch
    }));
  }

  function updateEventEditForm(patch: Partial<ProductEventEditFormState>) {
    setEventEditForm((current) =>
      current
        ? {
            ...current,
            ...patch
          }
        : current
    );
  }

  function selectEventDraftType(nextType: ProductEventEntryType) {
    setEventForm((current) => {
      const nextMaleCode =
        nextType === 'mating'
          ? current.maleCode || normalizeOptionalCode(form.mateCode) || ''
          : current.maleCode;
      const nextOldMateCode =
        nextType === 'change_mate'
          ? current.oldMateCode || normalizeOptionalCode(product?.mateCode) || ''
          : current.oldMateCode;
      const nextNewMateCode =
        nextType === 'change_mate'
          ? current.newMateCode || normalizeOptionalCode(form.mateCode) || ''
          : current.newMateCode;

      return {
        ...current,
        eventType: nextType,
        maleCode: nextMaleCode,
        oldMateCode: nextOldMateCode,
        newMateCode: nextNewMateCode
      };
    });
  }

  async function handleSave() {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }

    const normalizedCode = form.code.trim().toUpperCase();
    if (!normalizedCode) {
      setError('编码不能为空。');
      return;
    }

    const parsedOffspringPrice = parseOffspringUnitPrice(form.sex, form.offspringUnitPrice);
    if (parsedOffspringPrice === 'invalid') {
      setError('子代单价格式不正确，请输入非负数字。');
      return;
    }

    let eventPayload: CreateProductEventRequest | null = null;
    if (eventForm.eventType !== 'none') {
      if (!canRecordEvent) {
        setError('仅母龟支持录入种龟事件。请先将性别设置为母。');
        return;
      }

      const normalizedEventDate = eventForm.eventDate.trim();
      if (!normalizedEventDate) {
        setError('请选择事件日期。');
        return;
      }

      let parsedEggCount: number | null = null;
      if (eventForm.eventType === 'egg' && eventForm.eggCount.trim()) {
        const rawEggCount = Number(eventForm.eggCount.trim());
        if (!Number.isInteger(rawEggCount) || rawEggCount < 0 || rawEggCount > 999) {
          setError('产蛋数量需要是 0-999 的整数。');
          return;
        }
        parsedEggCount = rawEggCount;
      }

      const oldMateCode = normalizeOptionalCode(eventForm.oldMateCode);
      const newMateCode = normalizeOptionalCode(eventForm.newMateCode);
      if (eventForm.eventType === 'change_mate' && !oldMateCode && !newMateCode) {
        setError('换公事件至少填写旧配偶或新配偶其中一个。');
        return;
      }

      eventPayload = createProductEventRequestSchema.parse({
        eventType: eventForm.eventType,
        eventDate: normalizedEventDate,
        maleCode:
          eventForm.eventType === 'mating' ? normalizeOptionalCode(eventForm.maleCode) : null,
        eggCount: eventForm.eventType === 'egg' ? parsedEggCount : null,
        oldMateCode: eventForm.eventType === 'change_mate' ? oldMateCode : null,
        newMateCode: eventForm.eventType === 'change_mate' ? newMateCode : null,
        note: eventForm.note.trim() ? eventForm.note.trim() : null
      });
    }

    setSubmitting(true);
    setError(null);

    try {
      let nextSeriesId = form.seriesId.trim() ? form.seriesId.trim() : null;

      if (isCreatingSeries) {
        const createdSeries = await createSeriesIfNeeded({
          isDemoMode,
          code: newSeriesCode,
          name: newSeriesName,
          description: newSeriesDescription,
          sortOrder: newSeriesSortOrder,
          isActive: newSeriesIsActive
        });

        nextSeriesId = createdSeries.id;
        appendSeriesOption(createdSeries);
        onSeriesCreated?.(createdSeries);
      }

      const payload = updateProductRequestSchema.parse({
        code: normalizedCode,
        description: form.description.trim() ? form.description.trim() : null,
        seriesId: nextSeriesId,
        sex: form.sex ? form.sex : null,
        offspringUnitPrice: parsedOffspringPrice,
        sireCode: form.sireCode.trim() ? form.sireCode.trim().toUpperCase() : null,
        damCode: form.damCode.trim() ? form.damCode.trim().toUpperCase() : null,
        mateCode: form.mateCode.trim() ? form.mateCode.trim().toUpperCase() : null,
        excludeFromBreeding: form.excludeFromBreeding,
        hasSample: form.hasSample,
        inStock: form.inStock,
        isFeatured: form.isFeatured
      });

      if (isDemoMode) {
        const nextProduct = {
          ...currentProduct,
          type: currentProduct.type ?? 'breeder',
          code: normalizedCode,
          description: form.description.trim() ? form.description.trim() : null,
          seriesId: nextSeriesId,
          sex: form.sex ? form.sex : null,
          offspringUnitPrice: parsedOffspringPrice,
          sireCode: form.sireCode.trim() ? form.sireCode.trim().toUpperCase() : null,
          damCode: form.damCode.trim() ? form.damCode.trim().toUpperCase() : null,
          mateCode: form.mateCode.trim() ? form.mateCode.trim().toUpperCase() : null,
          excludeFromBreeding: form.excludeFromBreeding,
          hasSample: form.hasSample,
          inStock: form.inStock,
          isFeatured: form.isFeatured,
          updatedAt: new Date().toISOString()
        } as Product;

        const createdDemoEvent = eventPayload
          ? toDemoProductEvent(currentProduct.id, currentProduct.tenantId, eventPayload)
          : undefined;
        markProductsPageDirty(tenantSlug);
        onSaved(nextProduct, createdDemoEvent);
        onClose();
        return;
      }

      const response = await apiRequest(`/products/${currentProduct.id}`, {
        method: 'PUT',
        body: payload,
        requestSchema: updateProductRequestSchema,
        responseSchema: getProductResponseSchema
      });
      markProductsPageDirty(tenantSlug);

      let createdEvent: ProductEvent | undefined;
      if (eventPayload) {
        try {
          const eventResponse = await apiRequest(`/products/${currentProduct.id}/events`, {
            method: 'POST',
            body: eventPayload,
            requestSchema: createProductEventRequestSchema,
            responseSchema: createProductEventResponseSchema
          });
          createdEvent = eventResponse.event;
        } catch (eventRequestError) {
          onSaved(response.product);
          setError(`资料已保存，但事件录入失败：${formatApiError(eventRequestError)}`);
          return;
        }
      }

      onSaved(response.product, createdEvent);
      onClose();
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function reloadImages(productId: string) {
    const response = await apiRequest(`/products/${productId}/images`, {
      responseSchema: listProductImagesResponseSchema
    });
    setImages(response.images);
  }

  async function handleUploadImages(event: ChangeEvent<HTMLInputElement>) {
    const currentProduct = product;
    const fileList = event.target.files;
    if (!currentProduct || !fileList || fileList.length === 0) {
      return;
    }

    setSubmittingImages(true);
    setImageMessage(null);
    setImageError(null);

    if (isDemoMode) {
      setImageMessage('Demo 模式仅展示 UI，不执行真实上传。');
      setSubmittingImages(false);
      event.target.value = '';
      return;
    }

    try {
      const files = Array.from(fileList);
      for (const file of files) {
        await uploadSingleFileWithAuth(
          `/products/${currentProduct.id}/images`,
          file,
          uploadProductImageResponseSchema
        );
      }

      await reloadImages(currentProduct.id);
      setImageMessage(`已上传 ${files.length} 张图片。`);
    } catch (requestError) {
      setImageError(formatApiError(requestError));
    } finally {
      setSubmittingImages(false);
      event.target.value = '';
    }
  }

  async function handleDeleteImage(imageId: string) {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }

    setSubmittingImages(true);
    setImageMessage(null);
    setImageError(null);

    if (isDemoMode) {
      setImages((current) => current.filter((item) => item.id !== imageId));
      setSubmittingImages(false);
      setImageMessage('Demo 模式：已从页面移除图片。');
      return;
    }

    try {
      await apiRequest(`/products/${currentProduct.id}/images/${imageId}`, {
        method: 'DELETE',
        responseSchema: deleteProductImageResponseSchema
      });
      await reloadImages(currentProduct.id);
      setImageMessage('图片已删除。');
    } catch (requestError) {
      setImageError(formatApiError(requestError));
    } finally {
      setSubmittingImages(false);
    }
  }

  async function handleSetMainImage(imageId: string) {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }

    setSubmittingImages(true);
    setImageMessage(null);
    setImageError(null);

    if (isDemoMode) {
      setImages((current) =>
        current.map((item) => ({
          ...item,
          isMain: item.id === imageId
        }))
      );
      setSubmittingImages(false);
      setImageMessage('Demo 模式：主图标记已更新。');
      return;
    }

    try {
      const response = await apiRequest(`/products/${currentProduct.id}/images/${imageId}/main`, {
        method: 'PUT',
        responseSchema: setMainProductImageResponseSchema
      });

      setImages((current) =>
        current.map((item) => {
          if (item.id === response.image.id) {
            return response.image;
          }

          if (item.isMain) {
            return { ...item, isMain: false };
          }

          return item;
        })
      );
      setImageMessage('主图已更新。');
    } catch (requestError) {
      setImageError(formatApiError(requestError));
    } finally {
      setSubmittingImages(false);
    }
  }

  async function handleMoveImage(index: number, direction: -1 | 1) {
    const currentProduct = product;
    if (!currentProduct) {
      return;
    }

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) {
      return;
    }

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);

    setSubmittingImages(true);
    setImageMessage(null);
    setImageError(null);

    if (isDemoMode) {
      setImages(reordered);
      setCurrentImageIndex(nextIndex);
      setSubmittingImages(false);
      setImageMessage('Demo 模式：图片顺序已更新。');
      return;
    }

    try {
      const payload = reorderProductImagesRequestSchema.parse({
        imageIds: reordered.map((item) => item.id)
      });

      const response = await apiRequest(`/products/${currentProduct.id}/images/reorder`, {
        method: 'PUT',
        body: payload,
        requestSchema: reorderProductImagesRequestSchema,
        responseSchema: reorderProductImagesResponseSchema
      });

      setImages(response.images);
      setCurrentImageIndex(nextIndex);
      setImageMessage('图片顺序已更新。');
    } catch (requestError) {
      setImageError(formatApiError(requestError));
    } finally {
      setSubmittingImages(false);
    }
  }

  async function reloadEvents(productId: string) {
    if (isDemoMode) {
      return;
    }

    const response = await apiRequest(`/products/${productId}/events`, {
      responseSchema: listProductEventsResponseSchema
    });
    setEvents(sortProductEvents(response.events));
  }

  function closeEventEditor(force = false) {
    if (!force && submittingEventAction) {
      return;
    }

    setEditingEvent(null);
    setEventEditForm(null);
  }

  function handleStartEditEvent(eventItem: ProductEvent) {
    if (!isEditableEventType(eventItem.eventType)) {
      setEventError('当前事件类型暂不支持编辑。');
      return;
    }

    setEditingEvent(eventItem);
    setEventEditForm(toProductEventEditFormState(eventItem));
    setEventError(null);
    setEventMessage(null);
  }

  async function handleSubmitEventEdit() {
    const currentProduct = product;
    if (!currentProduct || !editingEvent || !eventEditForm) {
      return;
    }

    let payload: UpdateProductEventRequest;
    try {
      payload = buildUpdateEventPayload(editingEvent.eventType, eventEditForm);
    } catch (validationError) {
      setEventError(validationError instanceof Error ? validationError.message : '事件字段校验失败。');
      return;
    }

    setSubmittingEventAction(true);
    setEventError(null);
    setEventMessage(null);

    try {
      if (isDemoMode) {
        const nextEvent = toDemoUpdatedProductEvent(editingEvent, payload);
        setEvents((current) =>
          sortProductEvents(
            current.map((item) => (item.id === nextEvent.id ? nextEvent : item))
          )
        );
        setEventMessage('Demo 模式：事件已更新。');
        closeEventEditor(true);
        return;
      }

      const response = await apiRequest(`/products/${currentProduct.id}/events/${editingEvent.id}`, {
        method: 'PATCH',
        body: payload,
        requestSchema: updateProductEventRequestSchema,
        responseSchema: updateProductEventResponseSchema
      });
      setEvents((current) =>
        sortProductEvents(
          current.map((item) => (item.id === response.event.id ? response.event : item))
        )
      );
      setEventMessage('事件已更新。');
      markProductsPageDirty(tenantSlug);
      closeEventEditor(true);
    } catch (requestError) {
      setEventError(formatApiError(requestError));
    } finally {
      setSubmittingEventAction(false);
    }
  }

  async function handleDeleteEvent(eventItem: ProductEvent) {
    const currentProduct = product;
    if (!currentProduct || submittingEventAction) {
      return;
    }

    const confirmMessage = `确认删除「${formatEventTypeLabel(eventItem.eventType)} · ${formatEventDateLabel(
      eventItem.eventDate
    )}」吗？此操作不可恢复。`;
    if (typeof window !== 'undefined' && !window.confirm(confirmMessage)) {
      return;
    }

    setSubmittingEventAction(true);
    setEventError(null);
    setEventMessage(null);

    try {
      if (isDemoMode) {
        setEvents((current) => current.filter((item) => item.id !== eventItem.id));
        if (editingEvent?.id === eventItem.id) {
          closeEventEditor(true);
        }
        setEventMessage('Demo 模式：事件已删除。');
        return;
      }

      await apiRequest(`/products/${currentProduct.id}/events/${eventItem.id}`, {
        method: 'DELETE',
        responseSchema: deleteProductEventResponseSchema
      });
      await reloadEvents(currentProduct.id);
      if (editingEvent?.id === eventItem.id) {
        closeEventEditor(true);
      }
      setEventMessage('事件已删除。');
      markProductsPageDirty(tenantSlug);
    } catch (requestError) {
      setEventError(formatApiError(requestError));
    } finally {
      setSubmittingEventAction(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/45 p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="编辑产品资料"
      onClick={closeDrawer}
    >
      <section
        className="relative mx-auto flex h-[76svh] w-[min(92vw,48rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl sm:h-[88svh]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex h-9 min-w-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-600">
              {product.code}
            </span>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold text-neutral-900">编辑乌龟资料</p>
              <p className="text-xs text-neutral-500">用户 {tenantSlug}</p>
            </div>
            <button
              type="button"
              className={modalCloseButtonClass}
              onClick={closeDrawer}
              aria-label="关闭抽屉"
              disabled={submitting}
            >
              <X size={17} strokeWidth={2.6} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
            <div className="sticky top-0 z-10 rounded-2xl border border-neutral-200 bg-white/95 p-2 backdrop-blur">
              <div className="flex flex-wrap gap-2">
                {moduleTabs.map((tab) => (
                  <button
                    key={`edit-drawer-module-${tab.key}`}
                    type="button"
                    className={buildInteractivePillClass(activeModule === tab.key, {
                      activeClassName:
                        'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)]',
                      idleClassName:
                        'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900'
                    })}
                    onClick={() => {
                      if (tab.key !== 'breeding') {
                        closeEventEditor(true);
                      }
                      setActiveModule(tab.key);
                    }}
                    disabled={submitting || submittingImages || submittingEventAction}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeModule === 'basic' ? (
              <ProductEditBasicInfoSection
                submitting={submitting}
                loadingSeries={loadingSeries}
                code={form.code}
                seriesId={form.seriesId}
                seriesOptions={resolvedSeriesOptions}
                isCreatingSeries={isCreatingSeries}
                sex={form.sex}
                offspringUnitPrice={form.offspringUnitPrice}
                sireCode={form.sireCode}
                damCode={form.damCode}
                mateCode={form.mateCode}
                description={form.description}
                relationSuggestions={{
                  loading: relationCodeSuggestions.loadingRelationCodes,
                  visibleSuggestions: relationCodeSuggestions.visibleSuggestions,
                  isVisibleFor: relationCodeSuggestions.isVisibleFor,
                  onFocus: relationCodeSuggestions.handleFocus,
                  onBlur: relationCodeSuggestions.handleBlur,
                  onInputChange: relationCodeSuggestions.handleInputChange,
                  onSelect: relationCodeSuggestions.handleSelect
                }}
                newSeriesCode={newSeriesCode}
                newSeriesName={newSeriesName}
                newSeriesDescription={newSeriesDescription}
                newSeriesSortOrder={newSeriesSortOrder}
                newSeriesIsActive={newSeriesIsActive}
                onCodeChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    code: value
                  }))
                }
                onSeriesIdChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    seriesId: value
                  }))
                }
                onIsCreatingSeriesChange={setIsCreatingSeries}
                onSexChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    sex: value,
                    offspringUnitPrice: value === 'female' ? current.offspringUnitPrice : ''
                  }))
                }
                onOffspringUnitPriceChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    offspringUnitPrice: value
                  }))
                }
                onRelationCodeChange={setFormRelationCode}
                onDescriptionChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    description: value
                  }))
                }
                onNewSeriesCodeChange={setNewSeriesCode}
                onNewSeriesNameChange={setNewSeriesName}
                onNewSeriesDescriptionChange={setNewSeriesDescription}
                onNewSeriesSortOrderChange={setNewSeriesSortOrder}
                onNewSeriesIsActiveChange={setNewSeriesIsActive}
              />
            ) : null}

            {activeModule === 'breeding' ? (
              <>
                <ProductEventDraftSection
                  canRecordEvent={canRecordEvent}
                  eventForm={eventForm}
                  excludeFromBreeding={form.excludeFromBreeding}
                  submitting={submitting}
                  onSelectDraftType={selectEventDraftType}
                  onResetDraft={() => setEventForm(toDefaultEventFormState())}
                  onToggleExcludeFromBreeding={() =>
                    setForm((current) => ({
                      ...current,
                      excludeFromBreeding: !current.excludeFromBreeding
                    }))
                  }
                  onChange={updateEventForm}
                />

                <ProductEventHistorySection
                  loadingEvents={loadingEvents}
                  events={events}
                  eventMessage={eventMessage}
                  eventError={eventError}
                  eventSectionCollapsed={eventSectionCollapsed}
                  eventTypeFilter={eventTypeFilter}
                  eventKeywordFilter={eventKeywordFilter}
                  submitting={submitting}
                  submittingImages={submittingImages}
                  submittingEventAction={submittingEventAction}
                  onToggleCollapsed={() => setEventSectionCollapsed((current) => !current)}
                  onSetEventTypeFilter={setEventTypeFilter}
                  onSetEventKeywordFilter={setEventKeywordFilter}
                  onStartEditEvent={handleStartEditEvent}
                  onDeleteEvent={handleDeleteEvent}
                />
              </>
            ) : null}

            {activeModule === 'images' ? (
              <ProductEditImageWorkbench
              productId={product.id}
              isDemoMode={isDemoMode}
              submittingImages={submittingImages}
              loadingImages={loadingImages}
              images={images}
              currentImage={currentImage}
              currentImageIndex={currentImageIndex}
              imageMessage={imageMessage}
              imageError={imageError}
              onUploadImages={handleUploadImages}
              onDeleteImage={handleDeleteImage}
              onSetMainImage={handleSetMainImage}
              onMoveImage={handleMoveImage}
              onSetCurrentImageIndex={setCurrentImageIndex}
              />
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">{error}</p>
              </div>
            ) : null}
          </div>
        </div>

        <footer className="z-20 border-t border-neutral-200 bg-white px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDrawer}
              disabled={submitting || submittingImages || submittingEventAction}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={submitting || submittingImages || submittingEventAction}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  保存中...
                </>
              ) : (
                '保存资料'
              )}
            </Button>
          </div>
        </footer>

        <ProductEventEditDialog
          editingEvent={editingEvent}
          eventEditForm={eventEditForm}
          submittingEventAction={submittingEventAction}
          onClose={() => closeEventEditor()}
          onChange={updateEventEditForm}
          onSubmit={handleSubmitEventEdit}
        />
      </section>
    </div>
  );
}

function toProductEditFormState(product: Product | null): ProductEditFormState {
  if (!product) {
    return {
      code: '',
      description: '',
      seriesId: '',
      sex: '',
      offspringUnitPrice: '',
      sireCode: '',
      damCode: '',
      mateCode: '',
      excludeFromBreeding: false,
      hasSample: false,
      inStock: true,
      isFeatured: false
    };
  }

  return {
    code: product.code ?? '',
    description: product.description ?? '',
    seriesId: product.seriesId ?? '',
    sex: product.sex === 'male' || product.sex === 'female' ? product.sex : '',
    offspringUnitPrice:
      product.offspringUnitPrice === null || product.offspringUnitPrice === undefined
        ? ''
        : String(product.offspringUnitPrice),
    sireCode: product.sireCode ?? '',
    damCode: product.damCode ?? '',
    mateCode: product.mateCode ?? '',
    excludeFromBreeding: !!product.excludeFromBreeding,
    hasSample: !!product.hasSample,
    inStock: product.inStock ?? true,
    isFeatured: !!product.isFeatured
  };
}
