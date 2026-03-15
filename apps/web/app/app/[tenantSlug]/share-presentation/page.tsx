/* eslint-disable @next/next/no-img-element */
'use client';

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  TENANT_WATERMARK_MAX_TEXT_LENGTH,
  getTenantSharePresentationResponseSchema,
  getTenantWatermarkResponseSchema,
  meProfileResponseSchema,
  uploadTenantSharePresentationImageResponseSchema,
  updateTenantSharePresentationRequestSchema,
  updateTenantSharePresentationResponseSchema,
  updateTenantWatermarkRequestSchema,
  updateTenantWatermarkResponseSchema,
  type TenantSharePresentation,
  type TenantWatermarkState,
  type TenantWatermarkTextMode,
} from '@eggturtle/shared';
import {
  Check,
  ImagePlus,
  Images,
  MessageCircleMore,
  PenLine,
  RefreshCcw,
  Share2,
  Stamp,
} from 'lucide-react';

import ShareCoverCropDialog from './share-cover-crop-dialog';
import { apiRequest, resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import { ensureTenantRouteSession } from '@/lib/tenant-route-session';
import { uploadSingleFileWithAuth } from '@/lib/upload-client';
import TenantShareDialogTrigger from '@/components/tenant-share-dialog-trigger';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  MobileSettingsCard as SettingsCard,
  MobileSettingsEditorPanel as EditorPanel,
  MobileSettingsHeader,
  MobileSettingRow as SettingRow,
} from '@/components/ui/mobile-settings';
import { ImageUploadDropzone } from '@/components/ui/image-upload-dropzone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const DEFAULT_HERO_IMAGE = '/images/mg_04.jpg';
const FORM_ID = 'share-presentation-form';

type EditorKey = 'title' | 'subtitle' | 'contact' | 'cover' | 'carousel' | 'watermark' | null;

type FormState = {
  feedTitle: string;
  feedSubtitle: string;
  brandPrimary: string;
  brandSecondary: string;
  previewImageUrl: string;
  heroImagesText: string;
  showWechatBlock: boolean;
  wechatQrImageUrl: string;
  wechatId: string;
};

type PreviewState = {
  feedTitle: string;
  feedSubtitle: string;
  brandPrimary: string;
  brandSecondary: string;
  heroImages: string[];
  showWechatBlock: boolean;
  wechatQrImageUrl: string | null;
  wechatId: string | null;
};

type WatermarkFormState = {
  textMode: TenantWatermarkTextMode;
  customText: string;
  applyToSharePoster: boolean;
  applyToCouplePhoto: boolean;
  applyToCertificate: boolean;
};

type CropSource = {
  fileName: string;
  revokeOnClose: boolean;
  url: string;
};

const DEFAULT_FORM: FormState = {
  feedTitle: '',
  feedSubtitle: '',
  brandPrimary: '#FFD400',
  brandSecondary: '#1f2937',
  previewImageUrl: '',
  heroImagesText: '',
  showWechatBlock: false,
  wechatQrImageUrl: '',
  wechatId: '',
};

const DEFAULT_WATERMARK_FORM: WatermarkFormState = {
  textMode: 'AUTO_TENANT_NAME',
  customText: '',
  applyToSharePoster: true,
  applyToCouplePhoto: true,
  applyToCertificate: true,
};

export default function SharePresentationPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPreviewImage, setUploadingPreviewImage] = useState(false);
  const [uploadingHeroImages, setUploadingHeroImages] = useState(false);
  const [uploadingWechatImage, setUploadingWechatImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [savedForm, setSavedForm] = useState<FormState | null>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<CropSource | null>(null);
  const [cropUploading, setCropUploading] = useState(false);
  const [activeEditor, setActiveEditor] = useState<EditorKey>(null);
  const [watermarkSaving, setWatermarkSaving] = useState(false);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);
  const [watermarkMessage, setWatermarkMessage] = useState<string | null>(null);
  const [watermarkForm, setWatermarkForm] = useState<WatermarkFormState>(DEFAULT_WATERMARK_FORM);
  const [savedWatermarkForm, setSavedWatermarkForm] = useState<WatermarkFormState | null>(null);
  const [watermarkEntitlement, setWatermarkEntitlement] = useState<
    TenantWatermarkState['entitlement'] | null
  >(null);

  const heroImageUrls = useMemo(
    () => normalizeHeroImageList(form.heroImagesText, form.previewImageUrl),
    [form.heroImagesText, form.previewImageUrl],
  );
  const maxHeroImages = normalizeNullableString(form.previewImageUrl) ? 9 : 10;
  const isUploadingAsset =
    uploadingPreviewImage || uploadingHeroImages || uploadingWechatImage || cropUploading;
  const hasUnsavedChanges = useMemo(() => {
    if (!savedForm) {
      return false;
    }

    return JSON.stringify(form) !== JSON.stringify(savedForm);
  }, [form, savedForm]);

  const applyWatermarkState = useCallback((state: TenantWatermarkState) => {
    const nextForm = toWatermarkFormState(state);
    setWatermarkForm(nextForm);
    setSavedWatermarkForm(nextForm);
    setWatermarkEntitlement(state.entitlement);
    setWatermarkError(null);
  }, []);

  const applyWatermarkUnavailable = useCallback((message: string) => {
    setWatermarkForm(DEFAULT_WATERMARK_FORM);
    setSavedWatermarkForm(null);
    setWatermarkEntitlement(null);
    setWatermarkError(message);
    setWatermarkMessage(null);
  }, []);

  const applyPresentation = useCallback((presentation: TenantSharePresentation) => {
    const nextForm = toFormState(presentation);
    setForm(nextForm);
    setSavedForm(nextForm);
  }, []);

  const loadPresentation = useCallback(async () => {
    const [presentationResult, watermarkResult, profileResult] = await Promise.allSettled([
      apiRequest('/tenant-share-presentation', {
        responseSchema: getTenantSharePresentationResponseSchema,
      }),
      apiRequest('/tenant-watermark', {
        responseSchema: getTenantWatermarkResponseSchema,
      }),
      apiRequest('/me/profile', {
        responseSchema: meProfileResponseSchema,
      }),
    ]);

    if (presentationResult.status === 'rejected') {
      throw presentationResult.reason;
    }

    applyPresentation(presentationResult.value.presentation);
    setPreviewAvatarUrl(
      profileResult.status === 'fulfilled'
        ? (profileResult.value.profile.avatarUrl?.trim() ?? null)
        : null,
    );

    if (watermarkResult.status === 'fulfilled') {
      applyWatermarkState(watermarkResult.value);
      return;
    }

    applyWatermarkUnavailable(buildWatermarkLoadErrorMessage(watermarkResult.reason));
  }, [applyPresentation, applyWatermarkState, applyWatermarkUnavailable]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const access = await ensureTenantRouteSession({
          tenantSlug,
          missingTenantMessage: '缺少 tenantSlug。',
          router,
        });

        if (!access.ok) {
          if (!cancelled && access.reason === 'missing-tenant') {
            setError(access.message ?? '缺少 tenantSlug。');
            setLoading(false);
          }
          return;
        }

        await loadPresentation();

        if (!cancelled) {
          setLoading(false);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(formatApiError(requestError));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadPresentation, router, tenantSlug]);

  const preview = useMemo<PreviewState>(() => {
    const heroImages = buildHeroImages(form.previewImageUrl, form.heroImagesText);

    return {
      feedTitle: normalizeNullableString(form.feedTitle) ?? `${tenantSlug || '用户'} · 公开图鉴`,
      feedSubtitle:
        normalizeNullableString(form.feedSubtitle) ?? `${tenantSlug || '用户'} 在库产品展示`,
      brandPrimary: normalizeColor(form.brandPrimary) ?? '#FFD400',
      brandSecondary: normalizeColor(form.brandSecondary) ?? '#1f2937',
      heroImages: heroImages.length > 0 ? heroImages : [DEFAULT_HERO_IMAGE],
      showWechatBlock: form.showWechatBlock,
      wechatQrImageUrl: normalizeNullableString(form.wechatQrImageUrl),
      wechatId: normalizeNullableString(form.wechatId),
    };
  }, [form, tenantSlug]);

  const closeCropDialog = useCallback(() => {
    setCropSource((current) => {
      if (current?.revokeOnClose) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (cropSource?.revokeOnClose) {
        URL.revokeObjectURL(cropSource.url);
      }
    };
  }, [cropSource]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const request = updateTenantSharePresentationRequestSchema.parse({
        presentation: {
          feedTitle: normalizeNullableString(form.feedTitle),
          feedSubtitle: normalizeNullableString(form.feedSubtitle),
          brandPrimary: normalizeColor(form.brandPrimary),
          brandSecondary: normalizeColor(form.brandSecondary),
          heroImages: buildHeroImages(form.previewImageUrl, form.heroImagesText),
          showWechatBlock: form.showWechatBlock,
          wechatQrImageUrl: normalizeNullableString(form.wechatQrImageUrl),
          wechatId: normalizeNullableString(form.wechatId),
        },
      });

      const response = await apiRequest('/tenant-share-presentation', {
        method: 'PUT',
        body: request,
        requestSchema: updateTenantSharePresentationRequestSchema,
        responseSchema: updateTenantSharePresentationResponseSchema,
      });

      applyPresentation(response.presentation);
      setActiveEditor(null);
      setMessage('已保存，公开分享页刷新后立即生效。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSaving(false);
    }
  }

  function toggleEditor(nextEditor: Exclude<EditorKey, null>) {
    setActiveEditor((current) => (current === nextEditor ? null : nextEditor));
    setMessage(null);
    setError(null);
  }

  async function handleWatermarkSubmit() {
    setWatermarkSaving(true);
    setWatermarkError(null);
    setWatermarkMessage(null);

    try {
      const customText = normalizeNullableString(watermarkForm.customText);
      const selectedScopeCount = [
        watermarkForm.applyToSharePoster,
        watermarkForm.applyToCouplePhoto,
        watermarkForm.applyToCertificate,
      ].filter(Boolean).length;
      const hasCustomText = Boolean(customText);
      const request = updateTenantWatermarkRequestSchema.parse({
        config: {
          enabled: selectedScopeCount > 0,
          textMode: hasCustomText ? 'CUSTOM' : 'AUTO_TENANT_NAME',
          customText: customText ?? null,
          applyToSharePoster: watermarkForm.applyToSharePoster,
          applyToCouplePhoto: watermarkForm.applyToCouplePhoto,
          applyToCertificate: watermarkForm.applyToCertificate,
        },
      });

      const response = await apiRequest('/tenant-watermark', {
        method: 'PUT',
        body: request,
        requestSchema: updateTenantWatermarkRequestSchema,
        responseSchema: updateTenantWatermarkResponseSchema,
      });

      applyWatermarkState(response);
      setWatermarkMessage(
        selectedScopeCount > 0 ? '已保存商家水印，新生成图片会立即生效。' : '已关闭商家水印。',
      );
    } catch (requestError) {
      setWatermarkError(formatApiError(requestError));
    } finally {
      setWatermarkSaving(false);
    }
  }

  function openCropDialogFromFile(file: File) {
    const objectUrl = URL.createObjectURL(file);
    setCropSource({
      fileName: file.name || 'share-cover.jpg',
      revokeOnClose: true,
      url: objectUrl,
    });
  }

  async function handleUploadPreviewImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);
    openCropDialogFromFile(file);
  }

  async function handleConfirmCrop(payload: { blob: Blob; fileName: string }) {
    setCropUploading(true);
    setUploadingPreviewImage(true);
    setError(null);
    setMessage(null);

    try {
      const cropFile = new File([payload.blob], ensureJpegFileName(payload.fileName), {
        type: payload.blob.type || 'image/jpeg',
      });
      const uploaded = await uploadSharePresentationImage(cropFile);
      setForm((prev) => ({
        ...prev,
        previewImageUrl: uploaded.url,
        heroImagesText: normalizeHeroImageList(prev.heroImagesText, uploaded.url).join('\n'),
      }));
      setMessage('封面图已裁切并上传。');
      closeCropDialog();
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setCropUploading(false);
      setUploadingPreviewImage(false);
    }
  }

  function handleRecropCurrentPreview() {
    if (!form.previewImageUrl) {
      return;
    }

    setError(null);
    setMessage(null);
    setCropSource({
      fileName: 'share-cover.jpg',
      revokeOnClose: false,
      url: resolveAuthenticatedAssetUrl(form.previewImageUrl),
    });
  }

  async function handleUploadHeroImages(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    setUploadingHeroImages(true);
    setError(null);
    setMessage(null);

    try {
      const availableSlots = Math.max(0, maxHeroImages - heroImageUrls.length);
      if (availableSlots === 0) {
        setMessage(`轮播图最多 ${maxHeroImages} 张，请先删除后再上传。`);
        return;
      }

      const uploadQueue = files.slice(0, availableSlots);
      const uploadedUrls: string[] = [];
      for (const file of uploadQueue) {
        const uploaded = await uploadSharePresentationImage(file);
        uploadedUrls.push(uploaded.url);
      }

      setForm((prev) => ({
        ...prev,
        heroImagesText: normalizeHeroImageList(
          [
            ...normalizeHeroImageList(prev.heroImagesText, prev.previewImageUrl),
            ...uploadedUrls,
          ].join('\n'),
          prev.previewImageUrl,
        ).join('\n'),
      }));

      if (files.length > uploadQueue.length) {
        setMessage(`已上传 ${uploadQueue.length} 张，超出上限的图片已忽略。`);
      } else {
        setMessage(`已上传 ${uploadQueue.length} 张轮播图。`);
      }
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setUploadingHeroImages(false);
    }
  }

  async function handleUploadWechatImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setUploadingWechatImage(true);
    setError(null);
    setMessage(null);

    try {
      const uploaded = await uploadSharePresentationImage(file);
      setForm((prev) => ({
        ...prev,
        wechatQrImageUrl: uploaded.url,
      }));
      setMessage('微信二维码上传成功。');
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setUploadingWechatImage(false);
    }
  }

  function handleRestoreSaved() {
    if (!savedForm) {
      return;
    }

    setForm(savedForm);
    setActiveEditor(null);
    setError(null);
    setMessage('已恢复为当前已保存配置。');
  }

  const contactSummary = form.showWechatBlock
    ? `已开启${preview.wechatId ? ` · ${preview.wechatId}` : ''}${preview.wechatQrImageUrl ? ' · 已上传二维码' : ''}`
    : '已关闭';
  const coverSummary = form.previewImageUrl ? '已设置封面图' : '未单独设置，当前走默认头图';
  const coverDetail = form.previewImageUrl
    ? '点击后可重新上传、重新裁切或移除。'
    : heroImageUrls[0]
      ? '当前公开页会使用轮播图第一张作为头图。'
      : '当前公开页会使用系统默认头图。';
  const carouselSummary =
    heroImageUrls.length > 0 ? `已上传 ${heroImageUrls.length} 张` : '未上传轮播图';
  const defaultWatermarkText = useMemo(() => {
    return normalizeNullableString(form.feedTitle) ?? `${tenantSlug || '商家'} · 公开图鉴`;
  }, [form.feedTitle, tenantSlug]);

  const watermarkSummary = useMemo(() => {
    if (!watermarkEntitlement) return '加载中…';
    if (!watermarkEntitlement.canEdit) return '需升级 PRO';
    const scopes = [];
    if (watermarkForm.applyToSharePoster) scopes.push('详情图');
    if (watermarkForm.applyToCouplePhoto) scopes.push('夫妻图');
    if (watermarkForm.applyToCertificate) scopes.push('证书图');
    if (scopes.length === 0) return '未开启';
    return `${normalizeNullableString(watermarkForm.customText) || defaultWatermarkText} · ${scopes.join(' / ')}`;
  }, [
    defaultWatermarkText,
    watermarkEntitlement,
    watermarkForm.applyToCertificate,
    watermarkForm.applyToCouplePhoto,
    watermarkForm.applyToSharePoster,
    watermarkForm.customText,
  ]);
  const watermarkDetail = 'PRO 可在详情图、夫妻图、证书图中展示商家水印。';

  return (
    <>
      <main className="relative mx-auto w-full max-w-3xl overflow-x-hidden px-4 pb-[calc(56px+max(24px,env(safe-area-inset-bottom))+7rem)] pt-3 sm:px-5 sm:pb-28 sm:pt-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_right,rgba(255,212,0,0.18),transparent_36%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_34%)]" />
        <form id={FORM_ID} className="relative space-y-3" onSubmit={handleSubmit}>
          <MobileSettingsHeader title="分享配置" description="先看当前效果，再点某一项进去修改。" />

          {error ? (
            <StatusBanner tone="error">{error}</StatusBanner>
          ) : message ? (
            <StatusBanner tone="success">{message}</StatusBanner>
          ) : null}

          {loading ? (
            <LoadingCard />
          ) : (
            <>
              <SharePreviewHeroCard
                preview={preview}
                tenantSlug={tenantSlug}
                avatarUrl={previewAvatarUrl}
              >
                <TenantShareDialogTrigger
                  intent="feed"
                  title={preview.feedTitle}
                  subtitle={preview.feedSubtitle}
                  previewImageUrl={preview.heroImages[0] ?? null}
                  posterImageUrls={preview.heroImages}
                  assetSource="provided"
                  trigger={({ onClick, pending }) => (
                    <Button
                      type="button"
                      variant="primary"
                      className="h-9 rounded-full px-3.5 text-[13px] shadow-[0_6px_16px_rgba(15,23,42,0.14)]"
                      disabled={pending}
                      onClick={onClick}
                    >
                      <Share2 size={15} />
                      {pending ? '正在准备…' : '预览分享'}
                    </Button>
                  )}
                />
              </SharePreviewHeroCard>

              <SettingsCard>
                <SettingRow
                  active={activeEditor === 'title'}
                  icon={<PenLine size={16} />}
                  label="分享标题"
                  summary={preview.feedTitle}
                  detail={form.feedTitle.trim() ? '当前使用自定义标题' : '当前使用默认标题'}
                  onClick={() => toggleEditor('title')}
                />
                {activeEditor === 'title' ? (
                  <EditorPanel onClose={() => setActiveEditor(null)}>
                    <div className="space-y-2">
                      <Label htmlFor="feed-title">分享标题</Label>
                      <Input
                        id="feed-title"
                        value={form.feedTitle}
                        placeholder="留空将继续使用默认标题"
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, feedTitle: event.target.value }))
                        }
                      />
                    </div>
                  </EditorPanel>
                ) : null}

                <SettingRow
                  active={activeEditor === 'subtitle'}
                  icon={<PenLine size={16} />}
                  label="分享副标题"
                  summary={preview.feedSubtitle}
                  detail={form.feedSubtitle.trim() ? '当前使用自定义副标题' : '当前使用默认副标题'}
                  onClick={() => toggleEditor('subtitle')}
                />
                {activeEditor === 'subtitle' ? (
                  <EditorPanel onClose={() => setActiveEditor(null)}>
                    <div className="space-y-2">
                      <Label htmlFor="feed-subtitle">分享副标题</Label>
                      <Textarea
                        id="feed-subtitle"
                        rows={4}
                        value={form.feedSubtitle}
                        placeholder="留空将继续使用默认副标题"
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, feedSubtitle: event.target.value }))
                        }
                      />
                    </div>
                  </EditorPanel>
                ) : null}
              </SettingsCard>

              <SettingsCard>
                <SettingRow
                  active={activeEditor === 'contact'}
                  icon={<MessageCircleMore size={16} />}
                  label="联系方式"
                  summary={contactSummary}
                  detail={
                    form.showWechatBlock ? '点击修改开关、二维码和微信号' : '点击开启并配置联系方式'
                  }
                  onClick={() => toggleEditor('contact')}
                  leading={
                    preview.wechatQrImageUrl ? (
                      <img
                        src={resolveAuthenticatedAssetUrl(preview.wechatQrImageUrl)}
                        alt="联系方式二维码缩略图"
                        className="h-8 w-8 rounded-lg border border-neutral-200 bg-white object-cover p-0.5"
                      />
                    ) : undefined
                  }
                />
                {activeEditor === 'contact' ? (
                  <EditorPanel onClose={() => setActiveEditor(null)}>
                    <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-neutral-300"
                        checked={form.showWechatBlock}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            showWechatBlock: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="block text-sm font-medium text-neutral-900">
                          显示联系方式模块
                        </span>
                        <span className="mt-1 block text-xs text-neutral-500">
                          关闭时不会清空内容，只是不在公开页展示。
                        </span>
                      </span>
                    </label>

                    <div className="space-y-3">
                      <Label htmlFor="wechat-qr-upload">微信二维码</Label>
                      <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3">
                        <ImageUploadDropzone
                          inputId="wechat-qr-upload"
                          disabled={saving || isUploadingAsset}
                          onChange={handleUploadWechatImage}
                          actionText={
                            uploadingWechatImage
                              ? '上传中…'
                              : form.wechatQrImageUrl
                                ? '重新上传二维码'
                                : '上传二维码'
                          }
                          title={
                            form.wechatQrImageUrl ? '点击替换当前二维码' : '点击上传微信二维码'
                          }
                          description="建议上传清晰、对比度高的二维码图片。"
                        />
                        {form.wechatQrImageUrl ? (
                          <AssetPreviewMini
                            alt="微信二维码预览"
                            imageUrl={form.wechatQrImageUrl}
                            label="当前二维码"
                            trailing={
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={saving || isUploadingAsset}
                                onClick={() =>
                                  setForm((prev) => ({ ...prev, wechatQrImageUrl: '' }))
                                }
                              >
                                移除
                              </Button>
                            }
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wechat-id">微信号</Label>
                      <Input
                        id="wechat-id"
                        value={form.wechatId}
                        placeholder="可选，便于用户手动添加"
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, wechatId: event.target.value }))
                        }
                      />
                    </div>
                  </EditorPanel>
                ) : null}
              </SettingsCard>

              <SettingsCard>
                <SettingRow
                  active={activeEditor === 'cover'}
                  icon={<ImagePlus size={16} />}
                  label="封面图"
                  summary={coverSummary}
                  detail={coverDetail}
                  onClick={() => toggleEditor('cover')}
                  leading={
                    form.previewImageUrl ? (
                      <img
                        src={resolveAuthenticatedAssetUrl(form.previewImageUrl)}
                        alt="封面图缩略图"
                        className="h-8 w-8 rounded-lg border border-neutral-200 object-cover"
                      />
                    ) : undefined
                  }
                />
                {activeEditor === 'cover' ? (
                  <EditorPanel onClose={() => setActiveEditor(null)}>
                    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3">
                      <ImageUploadDropzone
                        inputId="preview-image-upload"
                        disabled={saving || isUploadingAsset}
                        onChange={handleUploadPreviewImage}
                        actionText={
                          uploadingPreviewImage || cropUploading
                            ? '处理中…'
                            : form.previewImageUrl
                              ? '重新上传封面图'
                              : '上传封面图'
                        }
                        title={form.previewImageUrl ? '点击替换当前封面图' : '点击上传封面图'}
                        description="上传后会先进入 16:10 裁切，再保存成最终封面。"
                      />
                      {form.previewImageUrl ? (
                        <AssetPreviewMini
                          alt="封面图预览"
                          imageUrl={form.previewImageUrl}
                          label="当前封面图"
                          detail="封面图支持裁切；轮播图只做补充展示。"
                          trailing={
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={saving || isUploadingAsset}
                                onClick={handleRecropCurrentPreview}
                              >
                                重新裁切
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={saving || isUploadingAsset}
                                onClick={() =>
                                  setForm((prev) => ({
                                    ...prev,
                                    previewImageUrl: '',
                                    heroImagesText: normalizeHeroImageList(
                                      prev.heroImagesText,
                                      '',
                                    ).join('\n'),
                                  }))
                                }
                              >
                                移除封面
                              </Button>
                            </div>
                          }
                        />
                      ) : (
                        <p className="text-xs text-neutral-500">
                          未设置封面时，将使用轮播第一张或默认图。
                        </p>
                      )}
                    </div>
                  </EditorPanel>
                ) : null}

                <SettingRow
                  active={activeEditor === 'carousel'}
                  icon={<Images size={16} />}
                  label="顶部轮播图"
                  summary={carouselSummary}
                  detail="点击修改轮播图；封面图之外的图片都在这里管理。"
                  onClick={() => toggleEditor('carousel')}
                  leading={
                    heroImageUrls[0] ? (
                      <div className="flex items-center gap-1">
                        {heroImageUrls.slice(0, 2).map((imageUrl, index) => (
                          <img
                            key={`${imageUrl}-${index}`}
                            src={resolveAuthenticatedAssetUrl(imageUrl)}
                            alt={`轮播图缩略图 ${index + 1}`}
                            className="h-8 w-8 rounded-lg border border-neutral-200 object-cover"
                          />
                        ))}
                      </div>
                    ) : undefined
                  }
                />
                {activeEditor === 'carousel' ? (
                  <EditorPanel onClose={() => setActiveEditor(null)}>
                    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
                        <span>支持多图上传，按上传顺序展示。</span>
                        <span>
                          已上传 {heroImageUrls.length}/{maxHeroImages}
                        </span>
                      </div>
                      <ImageUploadDropzone
                        inputId="hero-images-upload"
                        multiple
                        disabled={
                          saving || isUploadingAsset || heroImageUrls.length >= maxHeroImages
                        }
                        onChange={handleUploadHeroImages}
                        actionText={
                          uploadingHeroImages
                            ? '上传中…'
                            : heroImageUrls.length > 0
                              ? '继续上传轮播图'
                              : '上传轮播图'
                        }
                        title={
                          heroImageUrls.length > 0
                            ? `已上传 ${heroImageUrls.length} 张，可继续添加`
                            : '点击选择轮播图（支持多选）'
                        }
                        description="轮播图不裁切，建议直接上传横图。"
                      />
                      {heroImageUrls.length > 0 ? (
                        <div className="space-y-2">
                          {heroImageUrls.map((imageUrl, index) => (
                            <AssetPreviewMini
                              key={`${imageUrl}-${index}`}
                              alt={`轮播图 ${index + 1}`}
                              imageUrl={imageUrl}
                              label={`轮播图 ${index + 1}`}
                              detail="公开页里会排在封面图之后展示。"
                              trailing={
                                <Button
                                  type="button"
                                  variant="secondary"
                                  disabled={saving || isUploadingAsset}
                                  onClick={() =>
                                    setForm((prev) => ({
                                      ...prev,
                                      heroImagesText: normalizeHeroImageList(
                                        prev.heroImagesText,
                                        prev.previewImageUrl,
                                      )
                                        .filter((item) => item !== imageUrl)
                                        .join('\n'),
                                    }))
                                  }
                                >
                                  移除
                                </Button>
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500">
                          上传后的图片会在公开页头部轮播展示。
                        </p>
                      )}
                    </div>
                  </EditorPanel>
                ) : null}
              </SettingsCard>

              <SettingsCard>
                <SettingRow
                  active={activeEditor === 'watermark'}
                  icon={<Stamp size={16} />}
                  label="商家水印"
                  summary={watermarkSummary}
                  detail={watermarkDetail}
                  onClick={() => toggleEditor('watermark')}
                  trailing={
                    watermarkEntitlement ? (
                      <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        {watermarkEntitlement.plan}
                      </div>
                    ) : undefined
                  }
                />
                {activeEditor === 'watermark' ? (
                  <EditorPanel onClose={() => setActiveEditor(null)}>
                    <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3">
                      {watermarkError ? (
                        <StatusBanner tone="error">{watermarkError}</StatusBanner>
                      ) : watermarkMessage ? (
                        <StatusBanner tone="success">{watermarkMessage}</StatusBanner>
                      ) : null}

                      {!watermarkEntitlement ? (
                        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 p-4 text-sm text-neutral-600">
                          商家水印模块暂时不可用，但不会影响你继续编辑其他分享配置。
                        </div>
                      ) : !watermarkEntitlement.canEdit ? (
                        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4">
                          <p className="text-sm text-amber-900">
                            {watermarkEntitlement.reason ?? '升级到 PRO 后即可开启商家水印。'}
                          </p>
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => router.push(`/app/${tenantSlug}/subscription`)}
                          >
                            去升级 PRO
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
                          <div className="space-y-2">
                            <Label>水印模式</Label>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={[
                                  'inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                                  watermarkForm.textMode === 'CUSTOM'
                                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)]'
                                    : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white',
                                ].join(' ')}
                                disabled={watermarkSaving}
                                onClick={() =>
                                  setWatermarkForm((prev) => ({
                                    ...prev,
                                    textMode:
                                      prev.textMode === 'CUSTOM'
                                        ? 'AUTO_TENANT_NAME'
                                        : 'CUSTOM',
                                  }))
                                }
                              >
                                自定义文案
                              </button>
                            </div>
                            <p className="text-xs text-neutral-500">
                              不选时默认使用“{defaultWatermarkText}”。
                            </p>
                          </div>

                          {watermarkForm.textMode === 'CUSTOM' ? (
                            <div className="space-y-2">
                              <Label htmlFor="watermark-custom-text">自定义文案</Label>
                              <Input
                                id="watermark-custom-text"
                                maxLength={TENANT_WATERMARK_MAX_TEXT_LENGTH}
                                value={watermarkForm.customText}
                                placeholder={defaultWatermarkText}
                                disabled={watermarkSaving}
                                onChange={(event) =>
                                  setWatermarkForm((prev) => ({
                                    ...prev,
                                    customText: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <Label>生效范围</Label>
                            <p className="text-xs text-neutral-500">全部取消就等于不加水印。</p>
                            <div className="flex flex-wrap gap-2">
                              {(
                                [
                                  ['applyToSharePoster', '详情图'],
                                  ['applyToCouplePhoto', '夫妻图'],
                                  ['applyToCertificate', '证书图'],
                                ] as const
                              ).map(([key, label]) => (
                                <button
                                  key={key}
                                  type="button"
                                  disabled={watermarkSaving}
                                  onClick={() =>
                                    setWatermarkForm((prev) => ({
                                      ...prev,
                                      [key]: !prev[key],
                                    }))
                                  }
                                  className={[
                                    'inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                                    watermarkForm[key]
                                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)]'
                                      : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-white',
                                  ].join(' ')}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              disabled={watermarkSaving}
                              onClick={handleWatermarkSubmit}
                            >
                              <Check size={16} />
                              {watermarkSaving ? '保存中…' : '保存商家水印'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!savedWatermarkForm || watermarkSaving}
                              onClick={() => {
                                if (savedWatermarkForm) {
                                  setWatermarkForm(savedWatermarkForm);
                                  setWatermarkError(null);
                                  setWatermarkMessage('已恢复为当前已保存的商家水印配置。');
                                }
                              }}
                            >
                              恢复已保存
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </EditorPanel>
                ) : null}
              </SettingsCard>
            </>
          )}
        </form>
      </main>

      {hasUnsavedChanges && !loading ? (
        <div className="fixed inset-x-0 bottom-[calc(56px+max(24px,env(safe-area-inset-bottom))+12px)] z-40 px-4 sm:bottom-6 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-3xl border border-neutral-200 bg-white/96 p-2 shadow-[0_18px_36px_rgba(15,23,42,0.14)] backdrop-blur">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-2xl"
              disabled={!savedForm || saving || isUploadingAsset}
              onClick={handleRestoreSaved}
            >
              <RefreshCcw size={16} />
              恢复
            </Button>
            <Button
              type="submit"
              form={FORM_ID}
              variant="primary"
              className="flex-[1.2] rounded-2xl"
              disabled={saving || isUploadingAsset}
            >
              <Check size={16} />
              {saving ? '保存中…' : '保存并生效'}
            </Button>
          </div>
        </div>
      ) : null}

      <ShareCoverCropDialog
        open={Boolean(cropSource)}
        sourceName={cropSource?.fileName}
        sourceUrl={cropSource?.url ?? null}
        confirming={cropUploading}
        onClose={closeCropDialog}
        onConfirm={handleConfirmCrop}
      />
    </>
  );
}

type SharePreviewHeroCardProps = {
  avatarUrl?: string | null;
  children?: ReactNode;
  preview: PreviewState;
  tenantSlug: string;
};

function SharePreviewHeroCard({
  avatarUrl,
  children,
  preview,
  tenantSlug,
}: SharePreviewHeroCardProps) {
  const resolvedAvatarUrl = avatarUrl?.trim() ? resolveAuthenticatedAssetUrl(avatarUrl) : null;
  return (
    <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/78 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] bg-neutral-900 ring-1 ring-black/5">
        <img
          src={resolveAuthenticatedAssetUrl(preview.heroImages[0] ?? DEFAULT_HERO_IMAGE)}
          alt="分享封面预览"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-black/22 to-black/62" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${hexToRgba(preview.brandSecondary, 0.18)}, transparent 60%)`,
          }}
        />
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_right,rgba(255,212,0,0.18),transparent_42%)]" />
        <div className="absolute right-3 top-3">{children}</div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/68">share preview</p>
          <div className="mt-3 flex items-center gap-3">
            {resolvedAvatarUrl ? (
              <img
                src={resolvedAvatarUrl}
                alt="用户头像预览"
                className="h-11 w-11 rounded-full border border-white/80 object-cover shadow-[0_10px_24px_rgba(15,23,42,0.14)] ring-1 ring-black/5"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-stone-400 to-stone-600 text-base font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] ring-1 ring-black/5">
                {tenantSlug?.[0]?.toUpperCase() || '龟'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{preview.feedTitle}</p>
              <p className="mt-0.5 text-xs text-white/72">@{tenantSlug || 'share'}</p>
            </div>
          </div>
          <p className="mt-3 max-w-[82%] text-[13px] leading-snug text-white/82 sm:text-sm">
            {preview.feedSubtitle}
          </p>
        </div>
      </div>
    </Card>
  );
}

type AssetPreviewMiniProps = {
  alt: string;
  detail?: string;
  imageUrl: string;
  label: string;
  trailing?: ReactNode;
};

function AssetPreviewMini({ alt, detail, imageUrl, label, trailing }: AssetPreviewMiniProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50/90 p-2.5">
      <img
        src={resolveAuthenticatedAssetUrl(imageUrl)}
        alt={alt}
        className="h-12 w-12 rounded-lg border border-neutral-200 bg-white object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-neutral-900">{label}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-500">{imageUrl}</p>
        {detail ? <p className="mt-1 text-[11px] text-neutral-500">{detail}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

type StatusBannerProps = {
  children: ReactNode;
  tone: 'error' | 'success';
};

function StatusBanner({ children, tone }: StatusBannerProps) {
  return (
    <div
      aria-live="polite"
      role="status"
      className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_8px_22px_rgba(15,23,42,0.05)] backdrop-blur-sm ${
        tone === 'error'
          ? 'border-red-200/80 bg-red-50/90 text-red-700'
          : 'border-emerald-200/80 bg-emerald-50/90 text-emerald-700'
      }`}
    >
      {children}
    </div>
  );
}

function LoadingCard() {
  return (
    <Card className="rounded-[24px] border border-black/[0.05] bg-white/86 shadow-[0_12px_28px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <CardContent className="space-y-3 p-5">
        <div className="h-[220px] animate-pulse rounded-[24px] bg-gradient-to-br from-stone-100 to-neutral-100" />
        <div className="h-20 animate-pulse rounded-[20px] bg-gradient-to-r from-neutral-100 to-stone-100" />
        <div className="h-20 animate-pulse rounded-[20px] bg-gradient-to-r from-neutral-100 to-stone-100" />
        <div className="h-20 animate-pulse rounded-[20px] bg-gradient-to-r from-neutral-100 to-stone-100" />
      </CardContent>
    </Card>
  );
}

function buildWatermarkLoadErrorMessage(requestError: unknown) {
  const message = formatApiError(requestError);
  return `${message} 当前可继续编辑其他分享配置。`;
}

function toWatermarkFormState(state: TenantWatermarkState): WatermarkFormState {
  const isEnabled = state.config.enabled;
  return {
    textMode: state.config.textMode,
    customText: state.config.customText ?? '',
    applyToSharePoster: isEnabled ? state.config.applyToSharePoster : false,
    applyToCouplePhoto: isEnabled ? state.config.applyToCouplePhoto : false,
    applyToCertificate: isEnabled ? state.config.applyToCertificate : false,
  };
}

function toFormState(presentation: TenantSharePresentation): FormState {
  const [previewImageUrl = '', ...heroImages] = presentation.heroImages;

  return {
    feedTitle: presentation.feedTitle ?? '',
    feedSubtitle: presentation.feedSubtitle ?? '',
    brandPrimary: presentation.brandPrimary ?? '#FFD400',
    brandSecondary: presentation.brandSecondary ?? '#1f2937',
    previewImageUrl,
    heroImagesText: heroImages.join('\n'),
    showWechatBlock: presentation.showWechatBlock,
    wechatQrImageUrl: presentation.wechatQrImageUrl ?? '',
    wechatId: presentation.wechatId ?? '',
  };
}

function buildHeroImages(previewImageUrl: string, heroImagesText: string): string[] {
  const previewImage = normalizeNullableString(previewImageUrl);
  const heroImages = normalizeHeroImageList(heroImagesText, previewImageUrl);

  if (!previewImage) {
    return heroImages;
  }

  return [previewImage, ...heroImages.filter((item) => item !== previewImage)];
}

function normalizeHeroImageList(heroImagesText: string, previewImageUrl: string): string[] {
  const previewImage = normalizeNullableString(previewImageUrl);
  const maxImages = previewImage ? 9 : 10;
  const deduped = new Set<string>();

  for (const imageUrl of splitLines(heroImagesText)) {
    if (previewImage && imageUrl === previewImage) {
      continue;
    }

    deduped.add(imageUrl);
  }

  return [...deduped].slice(0, maxImages);
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeNullableString(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeColor(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const validHex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  if (!validHex.test(normalized)) {
    return null;
  }

  return normalized;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${Number.isNaN(red) ? 255 : red}, ${Number.isNaN(green) ? 212 : green}, ${Number.isNaN(blue) ? 0 : blue}, ${alpha})`;
}

function ensureJpegFileName(value: string): string {
  const normalized = value.trim().replace(/\.[^./]+$/, '');
  return `${normalized || 'share-cover'}.jpg`;
}

async function uploadSharePresentationImage(file: File) {
  const parsed = await uploadSingleFileWithAuth(
    '/tenant-share-presentation/images',
    file,
    uploadTenantSharePresentationImageResponseSchema,
  );
  return parsed.asset;
}
