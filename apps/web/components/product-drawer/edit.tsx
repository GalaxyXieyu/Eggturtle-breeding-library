/* eslint-disable @next/next/no-img-element */
'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  createProductEventRequestSchema,
  createProductEventResponseSchema,
  deleteProductEventResponseSchema,
  deleteProductImageResponseSchema,
  getProductResponseSchema,
  listProductsResponseSchema,
  listProductEventsResponseSchema,
  listProductImagesResponseSchema,
  listSeriesResponseSchema,
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
  ChevronDown,
  Loader2,
  X
} from 'lucide-react';

import { apiRequest } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { markProductsPageDirty } from '@/lib/products-page-cache';
import { uploadSingleFileWithAuth } from '@/lib/upload-client';
import ProductEditImageWorkbench from '@/components/product-drawer/edit-image-workbench';
import { createDemoDrawerImages } from '@/components/product-drawer/image-utils';
import {
  createSeriesIfNeeded,
  formatSeriesDisplayLabel,
  parseOffspringUnitPrice,
  toSuggestedSeriesCode,
  type ProductSeriesOption
} from '@/components/product-drawer/shared';
import { Button } from '@/components/ui/button';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';
import { Input } from '@/components/ui/input';
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

type ProductEventEntryType = 'mating' | 'egg' | 'change_mate';

type ProductEventFormState = {
  eventType: 'none' | ProductEventEntryType;
  eventDate: string;
  maleCode: string;
  eggCount: string;
  oldMateCode: string;
  newMateCode: string;
  note: string;
};

type ProductEventEditFormState = {
  eventDate: string;
  maleCode: string;
  eggCount: string;
  oldMateCode: string;
  newMateCode: string;
  note: string;
};

type EventTypeQuickFilter = 'all' | 'mating' | 'egg' | 'change_mate';
type EditDrawerModule = 'basic' | 'breeding' | 'images';
type RelationCodeFieldKey = 'sireCode' | 'damCode' | 'mateCode';

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
  const [resolvedSeriesOptions, setResolvedSeriesOptions] = useState<ProductSeriesOption[]>(
    seriesOptions ?? []
  );
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [newSeriesCode, setNewSeriesCode] = useState('');
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [newSeriesSortOrder, setNewSeriesSortOrder] = useState('');
  const [newSeriesIsActive, setNewSeriesIsActive] = useState(true);
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
  const [activeRelationField, setActiveRelationField] = useState<RelationCodeFieldKey>('sireCode');
  const [isRelationSuggestionOpen, setIsRelationSuggestionOpen] = useState(false);
  const [relationCodeKeyword, setRelationCodeKeyword] = useState('');
  const [relationCodeOptions, setRelationCodeOptions] = useState<string[]>([]);
  const [loadingRelationCodes, setLoadingRelationCodes] = useState(false);
  const [activeModule, setActiveModule] = useState<EditDrawerModule>('basic');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(toProductEditFormState(product));
    setIsCreatingSeries(false);
    setNewSeriesCode('');
    setNewSeriesName('');
    setNewSeriesDescription('');
    setNewSeriesSortOrder('');
    setNewSeriesIsActive(true);
    setEventForm(toDefaultEventFormState());
    setEvents([]);
    setEventError(null);
    setEventMessage(null);
    setEditingEvent(null);
    setEventEditForm(null);
    setEventSectionCollapsed(false);
    setEventTypeFilter('all');
    setEventKeywordFilter('');
    setActiveRelationField('sireCode');
    setIsRelationSuggestionOpen(false);
    setRelationCodeKeyword('');
    setRelationCodeOptions([]);
    setLoadingRelationCodes(false);
    setActiveModule('basic');
    setError(null);
  }, [open, product]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setResolvedSeriesOptions(seriesOptions ?? []);
  }, [open, seriesOptions]);

  useEffect(() => {
    if (!open || !product || isDemoMode) {
      return;
    }

    if ((seriesOptions ?? []).length > 0) {
      return;
    }

    let cancelled = false;
    setLoadingSeries(true);

    void (async () => {
      try {
        const response = await apiRequest('/series?page=1&pageSize=100', {
          responseSchema: listSeriesResponseSchema
        });

        if (!cancelled) {
          setResolvedSeriesOptions(
            response.items.map((item) => ({
              id: item.id,
              code: item.code,
              name: item.name
            }))
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatApiError(requestError));
        }
      } finally {
        if (!cancelled) {
          setLoadingSeries(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, open, product, seriesOptions]);

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

  useEffect(() => {
    if (!open) {
      return;
    }

    const keyword = relationCodeKeyword.trim();

    if (isDemoMode) {
      setRelationCodeOptions(
        uniqueNormalizedCodes([form.sireCode, form.damCode, form.mateCode]).slice(0, 12)
      );
      setLoadingRelationCodes(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const waitMs = keyword ? 180 : 0;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setLoadingRelationCodes(true);
        try {
          const query = new URLSearchParams();
          query.set('page', '1');
          query.set('pageSize', keyword ? '30' : '80');
          query.set('type', 'breeder');
          query.set('sortBy', keyword ? 'code' : 'updatedAt');
          query.set('sortDir', keyword ? 'asc' : 'desc');
          if (keyword) {
            query.set('search', keyword);
          }

          const response = await apiRequest(`/products?${query.toString()}`, {
            responseSchema: listProductsResponseSchema,
            signal: controller.signal
          });

          if (cancelled) {
            return;
          }

          setRelationCodeOptions(
            uniqueNormalizedCodes([
              form.sireCode,
              form.damCode,
              form.mateCode,
              ...response.products
                .filter((item) => item.id !== product?.id)
                .map((item) => item.code)
            ]).slice(0, 30)
          );
        } catch (requestError) {
          if (cancelled || (requestError instanceof DOMException && requestError.name === 'AbortError')) {
            return;
          }

          setRelationCodeOptions(
            uniqueNormalizedCodes([form.sireCode, form.damCode, form.mateCode]).slice(0, 12)
          );
        } finally {
          if (!cancelled) {
            setLoadingRelationCodes(false);
          }
        }
      })();
    }, waitMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    form.damCode,
    form.mateCode,
    form.sireCode,
    isDemoMode,
    open,
    product?.id,
    relationCodeKeyword
  ]);

  const canShowPrice = useMemo(() => form.sex === 'female', [form.sex]);
  const canRecordEvent = useMemo(() => form.sex === 'female', [form.sex]);
  const currentImage = useMemo(
    () => images[currentImageIndex] ?? images[0] ?? null,
    [currentImageIndex, images]
  );
  const hasMultipleImages = images.length > 1;
  const filteredEvents = useMemo(() => {
    const keyword = eventKeywordFilter.trim().toLowerCase();
    return events.filter((item) => {
      if (eventTypeFilter !== 'all' && item.eventType !== eventTypeFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [
        formatEventTypeLabel(item.eventType),
        formatEventDateLabel(item.eventDate),
        formatEventSummary(item),
        extractDisplayNote(item.note),
        item.maleCode ?? '',
        item.oldMateCode ?? '',
        item.newMateCode ?? '',
        item.eggCount === null || item.eggCount === undefined ? '' : String(item.eggCount)
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [eventKeywordFilter, eventTypeFilter, events]);
  const eventTypeCounts = useMemo(
    () => ({
      all: events.length,
      mating: events.filter((item) => item.eventType === 'mating').length,
      egg: events.filter((item) => item.eventType === 'egg').length,
      change_mate: events.filter((item) => item.eventType === 'change_mate').length
    }),
    [events]
  );
  const hasActiveEventFilters = eventTypeFilter !== 'all' || eventKeywordFilter.trim().length > 0;
  const relationCodeVisibleSuggestions = useMemo(
    () => relationCodeOptions.slice(0, 12),
    [relationCodeOptions]
  );
  const moduleTabs: Array<{ key: EditDrawerModule; label: string }> = useMemo(
    () => [
      { key: 'basic', label: '基础' },
      { key: 'breeding', label: '繁殖' },
      { key: 'images', label: '图片' }
    ],
    []
  );
  const eventEntryOptions: Array<{ key: ProductEventEntryType; label: string; hint: string }> = useMemo(
    () => [
      { key: 'mating', label: '交配', hint: '记录这次与哪只公龟配对。' },
      { key: 'egg', label: '产蛋', hint: '记录这次产蛋日期与数量。' },
      { key: 'change_mate', label: '换公', hint: '记录旧配偶与新配偶交接。' }
    ],
    []
  );
  const selectedSeriesLabel = useMemo(() => {
    if (!form.seriesId) {
      return '不选择系列';
    }

    const matched = resolvedSeriesOptions.find((item) => item.id === form.seriesId);
    if (matched) {
      return formatSeriesDisplayLabel(matched, { includeCodeForDistinct: true });
    }

    return `当前系列（${form.seriesId}）`;
  }, [form.seriesId, resolvedSeriesOptions]);
  const selectedEventEntry =
    eventForm.eventType === 'none'
      ? null
      : eventEntryOptions.find((item) => item.key === eventForm.eventType) ?? null;

  if (!open || !product) {
    return null;
  }

  function closeDrawer() {
    if (submitting || submittingImages || submittingEventAction) {
      return;
    }

    onClose();
  }

  function setRelationCodeField(field: RelationCodeFieldKey, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleRelationCodeInputFocus(field: RelationCodeFieldKey, value: string) {
    setActiveRelationField(field);
    setRelationCodeKeyword(value);
    setIsRelationSuggestionOpen(true);
  }

  function handleRelationCodeInputChange(field: RelationCodeFieldKey, value: string) {
    setRelationCodeField(field, value);
    setActiveRelationField(field);
    setRelationCodeKeyword(value);
    setIsRelationSuggestionOpen(true);
  }

  function handleRelationCodeInputBlur() {
    setIsRelationSuggestionOpen(false);
  }

  function isRelationSuggestionVisibleFor(field: RelationCodeFieldKey) {
    return isRelationSuggestionOpen && activeRelationField === field;
  }

  function applyRelationCodeSuggestion(field: RelationCodeFieldKey, code: string) {
    setRelationCodeField(field, code);
    setActiveRelationField(field);
    setRelationCodeKeyword(code);
    setIsRelationSuggestionOpen(false);
  }

  function renderRelationCodeSuggestionPanel(field: RelationCodeFieldKey) {
    if (!isRelationSuggestionVisibleFor(field)) {
      return null;
    }

    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xl">
        {loadingRelationCodes ? (
          <p className="px-3 py-2 text-xs text-neutral-500">检索中...</p>
        ) : relationCodeVisibleSuggestions.length > 0 ? (
          relationCodeVisibleSuggestions.map((code) => (
            <button
              key={`edit-drawer-relation-dropdown-${field}-${code}`}
              type="button"
              className="block w-full border-b border-neutral-100 px-3 py-2 text-left text-sm text-neutral-700 transition last:border-b-0 hover:bg-[#FFF6C2] hover:text-neutral-900"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyRelationCodeSuggestion(field, code)}
              disabled={submitting}
            >
              {code}
            </button>
          ))
        ) : (
          <p className="px-3 py-2 text-xs text-neutral-500">暂无匹配编号，可继续输入新编号。</p>
        )}
      </div>
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
        setResolvedSeriesOptions((current) => {
          if (current.some((item) => item.id === createdSeries.id)) {
            return current;
          }

          return [...current, createdSeries].sort((left, right) =>
            left.code.localeCompare(right.code, 'zh-CN')
          );
        });
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
              <>
                <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="edit-drawer-code" className="text-xs font-semibold text-neutral-600">
                  编码
                </label>
                <Input
                  id="edit-drawer-code"
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, code: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-semibold text-neutral-600">系列（药丸点选）</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buildInteractivePillClass(isCreatingSeries, {
                      activeClassName:
                        'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)]',
                      idleClassName:
                        'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900'
                    })}
                    onClick={() => {
                      setIsCreatingSeries(true);
                      setForm((current) => ({ ...current, seriesId: '' }));
                      setNewSeriesCode((current) => current || 'NEW-SERIES');
                    }}
                    disabled={submitting || loadingSeries}
                  >
                    + 新增系列
                  </button>
                  <button
                    type="button"
                    className={buildInteractivePillClass(!isCreatingSeries && !form.seriesId, {
                      activeClassName:
                        'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)]',
                      idleClassName:
                        'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900'
                    })}
                    onClick={() => {
                      setIsCreatingSeries(false);
                      setForm((current) => ({ ...current, seriesId: '' }));
                    }}
                    disabled={submitting}
                  >
                    不选择系列
                  </button>
                  {resolvedSeriesOptions.map((item) => {
                    const label = formatSeriesDisplayLabel(item, { includeCodeForDistinct: false });
                    const title = formatSeriesDisplayLabel(item, { includeCodeForDistinct: true });
                    return (
                      <button
                        key={`edit-drawer-series-pill-${item.id}`}
                        type="button"
                        title={title}
                        className={buildInteractivePillClass(!isCreatingSeries && form.seriesId === item.id, {
                          activeClassName:
                            'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)]',
                          idleClassName:
                            'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900'
                        })}
                        onClick={() => {
                          setIsCreatingSeries(false);
                          setForm((current) => ({ ...current, seriesId: item.id }));
                        }}
                        disabled={submitting}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {loadingSeries ? <p className="text-xs text-neutral-500">正在加载系列...</p> : null}
                <p className="text-xs text-neutral-500">当前选择：{isCreatingSeries ? '新增系列' : selectedSeriesLabel}</p>
                {isCreatingSeries ? (
                  <div className="space-y-3 rounded-2xl border border-[#FFD400]/35 bg-[#FFF9D8] p-3">
                    <p className="text-xs font-semibold text-neutral-700">新系列信息</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        placeholder="系列编码（必填）"
                        value={newSeriesCode}
                        onChange={(event) => setNewSeriesCode(event.target.value.toUpperCase())}
                        disabled={submitting}
                      />
                      <Input
                        placeholder="系列名称（必填）"
                        value={newSeriesName}
                        onChange={(event) => {
                          const value = event.target.value;
                          setNewSeriesName(value);
                          if (!newSeriesCode.trim()) {
                            setNewSeriesCode(toSuggestedSeriesCode(value));
                          }
                        }}
                        disabled={submitting}
                      />
                      <Input
                        type="number"
                        placeholder="排序（可选）"
                        value={newSeriesSortOrder}
                        onChange={(event) => setNewSeriesSortOrder(event.target.value)}
                        disabled={submitting}
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={newSeriesIsActive}
                          onChange={(event) => setNewSeriesIsActive(event.target.checked)}
                          disabled={submitting}
                        />
                        启用系列
                      </label>
                    </div>
                    <textarea
                      rows={2}
                      className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="系列描述（可选）"
                      value={newSeriesDescription}
                      onChange={(event) => setNewSeriesDescription(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600">性别（药丸点选）</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: '' as const, label: '未知' },
                    { value: 'female' as const, label: '母' },
                    { value: 'male' as const, label: '公' }
                  ].map((option) => (
                    <button
                      key={`sex-pill-${option.value || 'unknown'}`}
                      type="button"
                      className={buildInteractivePillClass(form.sex === option.value)}
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          sex: option.value,
                          offspringUnitPrice: option.value === 'female' ? current.offspringUnitPrice : ''
                        }));
                      }}
                      disabled={submitting}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {canShowPrice ? (
                <div className="grid gap-1.5">
                  <label htmlFor="edit-drawer-price" className="text-xs font-semibold text-neutral-600">
                    子代单价
                  </label>
                  <Input
                    id="edit-drawer-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.offspringUnitPrice}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        offspringUnitPrice: event.target.value
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-neutral-600">子代单价</label>
                  <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                    仅母龟可设置
                  </div>
                </div>
              )}
              <div className="relative grid gap-1.5">
                <label htmlFor="edit-drawer-sire" className="text-xs font-semibold text-neutral-600">
                  父本编号
                </label>
                <Input
                  id="edit-drawer-sire"
                  placeholder="输入后可联想"
                  autoComplete="off"
                  value={form.sireCode}
                  onFocus={(event) => handleRelationCodeInputFocus('sireCode', event.target.value)}
                  onBlur={handleRelationCodeInputBlur}
                  onChange={(event) => handleRelationCodeInputChange('sireCode', event.target.value)}
                />
                {renderRelationCodeSuggestionPanel('sireCode')}
              </div>
              <div className="relative grid gap-1.5">
                <label htmlFor="edit-drawer-dam" className="text-xs font-semibold text-neutral-600">
                  母本编号
                </label>
                <Input
                  id="edit-drawer-dam"
                  placeholder="输入后可联想"
                  autoComplete="off"
                  value={form.damCode}
                  onFocus={(event) => handleRelationCodeInputFocus('damCode', event.target.value)}
                  onBlur={handleRelationCodeInputBlur}
                  onChange={(event) => handleRelationCodeInputChange('damCode', event.target.value)}
                />
                {renderRelationCodeSuggestionPanel('damCode')}
              </div>
              <div className="relative grid gap-1.5">
                <label htmlFor="edit-drawer-mate" className="text-xs font-semibold text-neutral-600">
                  配偶编号
                </label>
                <Input
                  id="edit-drawer-mate"
                  placeholder="输入后可联想"
                  autoComplete="off"
                  value={form.mateCode}
                  onFocus={(event) => handleRelationCodeInputFocus('mateCode', event.target.value)}
                  onBlur={handleRelationCodeInputBlur}
                  onChange={(event) => handleRelationCodeInputChange('mateCode', event.target.value)}
                />
                {renderRelationCodeSuggestionPanel('mateCode')}
              </div>
            </div>

                <div className="grid gap-1.5">
                  <label htmlFor="edit-drawer-description" className="text-xs font-semibold text-neutral-600">
                    描述
                  </label>
                  <textarea
                    id="edit-drawer-description"
                    rows={4}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </div>
              </>
            ) : null}

            {activeModule === 'breeding' ? (
              <>
                <section className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-neutral-600">添加事件（可选）</p>
                <p className="text-xs text-neutral-500">
                  用于补录历史交配/产蛋/换公。修改“配偶编号”仍会自动记录换公事件。
                </p>
              </div>

              {!canRecordEvent ? (
                <p className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
                  仅母龟支持录入种龟事件。请先将性别设置为母。
                </p>
              ) : null}

              {canRecordEvent ? (
                <>
                  <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-2.5">
                    <p className="text-[11px] font-semibold text-neutral-500">快捷操作（单行）</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {eventEntryOptions.map((item) => (
                        <button
                          key={`edit-drawer-event-type-${item.key}`}
                          type="button"
                          className={buildInteractivePillClass(eventForm.eventType === item.key, {
                            baseClassName:
                              'flex h-8 w-full items-center justify-center rounded-full border px-1 text-center text-[11px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
                            activeClassName:
                              'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)] whitespace-nowrap',
                            idleClassName:
                              'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900 whitespace-nowrap'
                          })}
                          onClick={() => {
                            if (eventForm.eventType === item.key) {
                              setEventForm(toDefaultEventFormState());
                              return;
                            }

                            selectEventDraftType(item.key);
                          }}
                          disabled={submitting}
                        >
                          {item.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={buildInteractivePillClass(form.excludeFromBreeding, {
                          baseClassName:
                            'flex h-8 w-full items-center justify-center rounded-full border px-1 text-center text-[11px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
                          activeClassName:
                            'border-red-300 bg-red-50 text-red-700 shadow-[0_8px_18px_rgba(248,113,113,0.18)] whitespace-nowrap',
                          idleClassName:
                            'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-red-200 hover:bg-red-50/70 hover:text-red-700 whitespace-nowrap'
                        })}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            excludeFromBreeding: !current.excludeFromBreeding
                          }))
                        }
                        disabled={submitting}
                      >
                        不再繁殖
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      前三个按钮互斥，点击其他会切换，再点当前可取消；只有前三个会展开下方录入内容。
                    </p>
                    {selectedEventEntry ? <p className="text-xs text-neutral-600">{selectedEventEntry.hint}</p> : null}
                  </div>

                  {eventForm.eventType === 'none' ? (
                    <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
                      当前未选择新增事件。你可以直接保存资料，或继续向下查看历史事件。
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-[#FFD400]/35 bg-[#FFF9D8] p-3">
                      <p className="text-[11px] font-semibold text-neutral-600">
                        新增{formatEventTypeLabel(eventForm.eventType)}事件
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                          <label htmlFor="edit-drawer-event-date" className="text-xs font-semibold text-neutral-600">
                            事件日期
                          </label>
                          <Input
                            id="edit-drawer-event-date"
                            type="date"
                            value={eventForm.eventDate}
                            onChange={(event) =>
                              setEventForm((current) => ({
                                ...current,
                                eventDate: event.target.value
                              }))
                            }
                            disabled={submitting}
                          />
                        </div>

                        {eventForm.eventType === 'mating' ? (
                          <div className="grid gap-1.5">
                            <label htmlFor="edit-drawer-event-male-code" className="text-xs font-semibold text-neutral-600">
                              公龟编码（可选）
                            </label>
                            <Input
                              id="edit-drawer-event-male-code"
                              value={eventForm.maleCode}
                              placeholder="留空时使用配偶编号"
                              onChange={(event) =>
                                setEventForm((current) => ({
                                  ...current,
                                  maleCode: event.target.value
                                }))
                              }
                              disabled={submitting}
                            />
                          </div>
                        ) : null}

                        {eventForm.eventType === 'egg' ? (
                          <div className="grid gap-1.5">
                            <label htmlFor="edit-drawer-event-egg-count" className="text-xs font-semibold text-neutral-600">
                              产蛋数量（可选）
                            </label>
                            <Input
                              id="edit-drawer-event-egg-count"
                              type="number"
                              min={0}
                              max={999}
                              value={eventForm.eggCount}
                              onChange={(event) =>
                                setEventForm((current) => ({
                                  ...current,
                                  eggCount: event.target.value
                                }))
                              }
                              disabled={submitting}
                            />
                          </div>
                        ) : null}

                        {eventForm.eventType === 'change_mate' ? (
                          <>
                            <div className="grid gap-1.5">
                              <label htmlFor="edit-drawer-event-old-mate" className="text-xs font-semibold text-neutral-600">
                                旧配偶编码
                              </label>
                              <Input
                                id="edit-drawer-event-old-mate"
                                value={eventForm.oldMateCode}
                                onChange={(event) =>
                                  setEventForm((current) => ({
                                    ...current,
                                    oldMateCode: event.target.value
                                  }))
                                }
                                disabled={submitting}
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <label htmlFor="edit-drawer-event-new-mate" className="text-xs font-semibold text-neutral-600">
                                新配偶编码
                              </label>
                              <Input
                                id="edit-drawer-event-new-mate"
                                value={eventForm.newMateCode}
                                onChange={(event) =>
                                  setEventForm((current) => ({
                                    ...current,
                                    newMateCode: event.target.value
                                  }))
                                }
                                disabled={submitting}
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                      <div className="grid gap-1.5">
                        <label htmlFor="edit-drawer-event-note" className="text-xs font-semibold text-neutral-600">
                          事件备注（可选）
                        </label>
                        <textarea
                          id="edit-drawer-event-note"
                          rows={3}
                          className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                          value={eventForm.note}
                          onChange={(event) =>
                            setEventForm((current) => ({
                              ...current,
                              note: event.target.value
                            }))
                          }
                          disabled={submitting}
                          placeholder="例如：本次为补录历史数据。"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : null}
                </section>

                <section className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-600">历史事件（可编辑 / 删除）</p>
                  <p className="text-xs text-neutral-500">
                    修改会直接联动后台批次/证书快照；删除为高风险操作，请确认后执行。
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-500">
                    {loadingEvents
                      ? '加载中...'
                      : hasActiveEventFilters
                        ? `${filteredEvents.length}/${events.length} 条`
                        : `${events.length} 条`}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    onClick={() => setEventSectionCollapsed((current) => !current)}
                    disabled={submittingEventAction}
                  >
                    {eventSectionCollapsed ? '展开' : '收起'}
                    <ChevronDown
                      size={14}
                      className={`transition-transform ${eventSectionCollapsed ? '-rotate-90' : 'rotate-0'}`}
                    />
                  </Button>
                </div>
              </div>

              {eventMessage ? (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  {eventMessage}
                </p>
              ) : null}
              {eventError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {eventError}
                </p>
              ) : null}

              {eventSectionCollapsed ? (
                <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
                  历史事件已折叠，点击“展开”查看。
                </div>
              ) : (
                <>
                  <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-2.5">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'all' as const, label: '全部', count: eventTypeCounts.all },
                        { key: 'mating' as const, label: '交配', count: eventTypeCounts.mating },
                        { key: 'egg' as const, label: '产蛋', count: eventTypeCounts.egg },
                        { key: 'change_mate' as const, label: '换公', count: eventTypeCounts.change_mate }
                      ].map((option) => (
                        <button
                          key={`event-filter-${option.key}`}
                          type="button"
                          className={buildInteractivePillClass(eventTypeFilter === option.key)}
                          onClick={() => setEventTypeFilter(option.key)}
                          disabled={submittingEventAction}
                        >
                          {option.label}（{option.count}）
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={eventKeywordFilter}
                        onChange={(event) => setEventKeywordFilter(event.target.value)}
                        placeholder="快速搜索：日期 / 编码 / 备注"
                        disabled={submittingEventAction}
                      />
                      {eventKeywordFilter.trim() ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 px-2 text-xs"
                          onClick={() => setEventKeywordFilter('')}
                          disabled={submittingEventAction}
                        >
                          清空
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {loadingEvents ? (
                    <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
                      正在加载事件...
                    </div>
                  ) : events.length === 0 ? (
                    <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
                      当前暂无事件记录。
                    </div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
                      没有匹配的事件，试试放宽筛选条件。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredEvents.map((item) => {
                        const displayNote = extractDisplayNote(item.note);
                        return (
                          <article key={`drawer-event-row-${item.id}`} className="rounded-xl border border-neutral-200 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-semibold text-neutral-900">
                                  {formatEventTypeLabel(item.eventType)}
                                  <span className="ml-2 text-xs font-medium text-neutral-500">
                                    {formatEventDateLabel(item.eventDate)}
                                  </span>
                                </p>
                                <p className="text-xs text-neutral-600">{formatEventSummary(item)}</p>
                                {displayNote ? (
                                  <p className="text-xs text-neutral-500">备注：{displayNote}</p>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="h-8 px-2 text-xs"
                                  disabled={
                                    submitting ||
                                    submittingImages ||
                                    submittingEventAction ||
                                    !isEditableEventType(item.eventType)
                                  }
                                  onClick={() => handleStartEditEvent(item)}
                                >
                                  编辑
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="h-8 border-red-200 bg-red-50 px-2 text-xs text-red-700 hover:bg-red-100"
                                  disabled={submitting || submittingImages || submittingEventAction}
                                  onClick={() => void handleDeleteEvent(item)}
                                >
                                  删除
                                </Button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
                </section>
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
              hasMultipleImages={hasMultipleImages}
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

        {editingEvent && eventEditForm ? (
          <div
            className="absolute inset-0 z-30 flex items-end bg-black/45 p-3 sm:items-center sm:p-6"
            onClick={() => closeEventEditor()}
          >
            <section
              className="mx-auto w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl sm:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">编辑事件</p>
                  <p className="text-xs text-neutral-500">
                    {formatEventTypeLabel(editingEvent.eventType)} · {formatEventDateLabel(editingEvent.eventDate)}
                  </p>
                </div>
                <button
                  type="button"
                  className={modalCloseButtonClass}
                  onClick={() => closeEventEditor()}
                  disabled={submittingEventAction}
                  aria-label="关闭事件编辑弹窗"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <label htmlFor="event-edit-date" className="text-xs font-semibold text-neutral-600">
                    事件日期
                  </label>
                  <Input
                    id="event-edit-date"
                    type="date"
                    value={eventEditForm.eventDate}
                    onChange={(event) =>
                      setEventEditForm((current) =>
                        current
                          ? {
                              ...current,
                              eventDate: event.target.value
                            }
                          : current
                      )
                    }
                    disabled={submittingEventAction}
                  />
                </div>

                {editingEvent.eventType === 'mating' ? (
                  <div className="grid gap-1.5">
                    <label htmlFor="event-edit-male-code" className="text-xs font-semibold text-neutral-600">
                      公龟编码（可选）
                    </label>
                    <Input
                      id="event-edit-male-code"
                      value={eventEditForm.maleCode}
                      onChange={(event) =>
                        setEventEditForm((current) =>
                          current
                            ? {
                                ...current,
                                maleCode: event.target.value
                              }
                            : current
                        )
                      }
                      disabled={submittingEventAction}
                    />
                  </div>
                ) : null}

                {editingEvent.eventType === 'egg' ? (
                  <div className="grid gap-1.5">
                    <label htmlFor="event-edit-egg-count" className="text-xs font-semibold text-neutral-600">
                      产蛋数量（可选）
                    </label>
                    <Input
                      id="event-edit-egg-count"
                      type="number"
                      min={0}
                      max={999}
                      value={eventEditForm.eggCount}
                      onChange={(event) =>
                        setEventEditForm((current) =>
                          current
                            ? {
                                ...current,
                                eggCount: event.target.value
                              }
                            : current
                        )
                      }
                      disabled={submittingEventAction}
                    />
                  </div>
                ) : null}

                {editingEvent.eventType === 'change_mate' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label htmlFor="event-edit-old-mate" className="text-xs font-semibold text-neutral-600">
                        旧配偶编码
                      </label>
                      <Input
                        id="event-edit-old-mate"
                        value={eventEditForm.oldMateCode}
                        onChange={(event) =>
                          setEventEditForm((current) =>
                            current
                              ? {
                                  ...current,
                                  oldMateCode: event.target.value
                                }
                              : current
                          )
                        }
                        disabled={submittingEventAction}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label htmlFor="event-edit-new-mate" className="text-xs font-semibold text-neutral-600">
                        新配偶编码
                      </label>
                      <Input
                        id="event-edit-new-mate"
                        value={eventEditForm.newMateCode}
                        onChange={(event) =>
                          setEventEditForm((current) =>
                            current
                              ? {
                                  ...current,
                                  newMateCode: event.target.value
                                }
                              : current
                          )
                        }
                        disabled={submittingEventAction}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-1.5">
                  <label htmlFor="event-edit-note" className="text-xs font-semibold text-neutral-600">
                    事件备注（可选）
                  </label>
                  <textarea
                    id="event-edit-note"
                    rows={3}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                    value={eventEditForm.note}
                    onChange={(event) =>
                      setEventEditForm((current) =>
                        current
                          ? {
                              ...current,
                              note: event.target.value
                            }
                          : current
                      )
                    }
                    disabled={submittingEventAction}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => closeEventEditor()}
                  disabled={submittingEventAction}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSubmitEventEdit()}
                  disabled={submittingEventAction}
                >
                  {submittingEventAction ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存事件'
                  )}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
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

function toDefaultEventFormState(): ProductEventFormState {
  return {
    eventType: 'none',
    eventDate: toLocalDateInputValue(new Date()),
    maleCode: '',
    eggCount: '',
    oldMateCode: '',
    newMateCode: '',
    note: ''
  };
}

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeOptionalCode(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function uniqueNormalizedCodes(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeOptionalCode(value);
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function isEditableEventType(eventType: string): eventType is 'mating' | 'egg' | 'change_mate' {
  return eventType === 'mating' || eventType === 'egg' || eventType === 'change_mate';
}

function toProductEventEditFormState(event: ProductEvent): ProductEventEditFormState {
  return {
    eventDate: toDateInputValue(event.eventDate),
    maleCode: event.maleCode ?? '',
    eggCount: event.eggCount === null || event.eggCount === undefined ? '' : String(event.eggCount),
    oldMateCode: event.oldMateCode ?? '',
    newMateCode: event.newMateCode ?? '',
    note: extractDisplayNote(event.note)
  };
}

function buildUpdateEventPayload(
  eventType: string,
  form: ProductEventEditFormState
): UpdateProductEventRequest {
  if (!isEditableEventType(eventType)) {
    throw new Error('当前事件类型暂不支持编辑。');
  }

  const eventDate = form.eventDate.trim();
  if (!eventDate) {
    throw new Error('请选择事件日期。');
  }

  const note = form.note.trim() ? form.note.trim() : null;
  const maleCode = normalizeOptionalCode(form.maleCode);
  const oldMateCode = normalizeOptionalCode(form.oldMateCode);
  const newMateCode = normalizeOptionalCode(form.newMateCode);

  let eggCount: number | null | undefined = undefined;
  if (eventType === 'egg') {
    if (!form.eggCount.trim()) {
      eggCount = null;
    } else {
      const rawEggCount = Number(form.eggCount.trim());
      if (!Number.isInteger(rawEggCount) || rawEggCount < 0 || rawEggCount > 999) {
        throw new Error('产蛋数量需要是 0-999 的整数。');
      }
      eggCount = rawEggCount;
    }
  }

  if (eventType === 'change_mate' && !oldMateCode && !newMateCode) {
    throw new Error('换公事件至少填写旧配偶或新配偶其中一个。');
  }

  return updateProductEventRequestSchema.parse({
    eventDate,
    note,
    maleCode: eventType === 'mating' ? maleCode : undefined,
    eggCount: eventType === 'egg' ? eggCount : undefined,
    oldMateCode: eventType === 'change_mate' ? oldMateCode : undefined,
    newMateCode: eventType === 'change_mate' ? newMateCode : undefined
  });
}

function sortProductEvents(items: ProductEvent[]): ProductEvent[] {
  return [...items].sort((left, right) => {
    const eventDateDiff = new Date(right.eventDate).getTime() - new Date(left.eventDate).getTime();
    if (eventDateDiff !== 0) {
      return eventDateDiff;
    }

    const createdAtDiff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return right.id.localeCompare(left.id, 'zh-CN');
  });
}

function toDemoUpdatedProductEvent(event: ProductEvent, payload: UpdateProductEventRequest): ProductEvent {
  return {
    ...event,
    eventDate: payload.eventDate ? toEventDateIso(payload.eventDate) : event.eventDate,
    maleCode: payload.maleCode !== undefined ? normalizeOptionalCode(payload.maleCode) : event.maleCode,
    eggCount: payload.eggCount !== undefined ? payload.eggCount : event.eggCount,
    oldMateCode:
      payload.oldMateCode !== undefined ? normalizeOptionalCode(payload.oldMateCode) : event.oldMateCode,
    newMateCode:
      payload.newMateCode !== undefined ? normalizeOptionalCode(payload.newMateCode) : event.newMateCode,
    note: payload.note !== undefined ? payload.note : event.note,
    updatedAt: new Date().toISOString()
  };
}

function extractDisplayNote(note: string | null): string {
  if (!note) {
    return '';
  }

  return note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !(line.startsWith('#') && line.includes('=')))
    .join('\n');
}

function toDateInputValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return toLocalDateInputValue(new Date());
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatEventTypeLabel(eventType: string): string {
  if (eventType === 'mating') {
    return '交配';
  }
  if (eventType === 'egg') {
    return '产蛋';
  }
  if (eventType === 'change_mate') {
    return '换公';
  }

  return eventType || '未知';
}

function formatEventDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatEventSummary(event: ProductEvent): string {
  if (event.eventType === 'mating') {
    return `公龟编码：${event.maleCode || '未填写'}`;
  }
  if (event.eventType === 'egg') {
    return `产蛋数量：${event.eggCount ?? '未填写'}`;
  }
  if (event.eventType === 'change_mate') {
    return `旧配偶：${event.oldMateCode || '未填写'}；新配偶：${event.newMateCode || '未填写'}`;
  }

  return '未定义事件详情';
}

function toDemoProductEvent(
  productId: string,
  tenantId: string,
  payload: CreateProductEventRequest
): ProductEvent {
  const now = new Date().toISOString();

  return {
    id: `demo-event-${Date.now()}`,
    tenantId,
    productId,
    eventType: payload.eventType,
    eventDate: toEventDateIso(payload.eventDate),
    maleCode: normalizeOptionalCode(payload.maleCode),
    eggCount: payload.eggCount ?? null,
    oldMateCode: normalizeOptionalCode(payload.oldMateCode),
    newMateCode: normalizeOptionalCode(payload.newMateCode),
    note: payload.note ?? null,
    createdAt: now,
    updatedAt: now
  };
}

function toEventDateIso(value: string) {
  const normalized = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T00:00:00.000Z`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}
