/* eslint-disable @next/next/no-img-element */
'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getTenantSharePresentationResponseSchema,
  updateTenantSharePresentationRequestSchema,
  updateTenantSharePresentationResponseSchema,
  type TenantSharePresentation
} from '@eggturtle/shared';

import { ApiError, apiRequest, getAccessToken } from '../../../../lib/api-client';
import { switchTenantBySlug } from '../../../../lib/tenant-session';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';

const DEFAULT_HERO_IMAGE = '/images/mg_04.jpg';

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

type ThemeColorOption = {
  label: string;
  value: string;
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
  wechatId: ''
};

const PRIMARY_COLOR_OPTIONS: ThemeColorOption[] = [
  { label: '金黄', value: '#FFD400' },
  { label: '橙金', value: '#F59E0B' },
  { label: '珊瑚', value: '#FB7185' },
  { label: '青蓝', value: '#06B6D4' },
  { label: '翠绿', value: '#22C55E' },
  { label: '紫罗兰', value: '#8B5CF6' }
];

const SECONDARY_COLOR_OPTIONS: ThemeColorOption[] = [
  { label: '石墨', value: '#1f2937' },
  { label: '深蓝灰', value: '#334155' },
  { label: '午夜蓝', value: '#172554' },
  { label: '深墨绿', value: '#14532d' },
  { label: '深酒红', value: '#4c0519' },
  { label: '深棕', value: '#3f2a18' }
];

export default function SharePresentationPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const primaryColorOptions = useMemo(
    () => withCurrentColorOption(PRIMARY_COLOR_OPTIONS, normalizeColor(form.brandPrimary)),
    [form.brandPrimary]
  );
  const secondaryColorOptions = useMemo(
    () => withCurrentColorOption(SECONDARY_COLOR_OPTIONS, normalizeColor(form.brandSecondary)),
    [form.brandSecondary]
  );

  const loadPresentation = useCallback(async () => {
    const response = await apiRequest('/tenant-share-presentation', {
      responseSchema: getTenantSharePresentationResponseSchema
    });

    setForm(toFormState(response.presentation));
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    if (!tenantSlug) {
      setError('缺少 tenantSlug。');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await switchTenantBySlug(tenantSlug);
        await loadPresentation();

        if (!cancelled) {
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
  }, [loadPresentation, router, tenantSlug]);

  const preview = useMemo(() => {
    const heroImages = buildHeroImages(form.previewImageUrl, form.heroImagesText);

    return {
      feedTitle: normalizeNullableString(form.feedTitle) ?? `${tenantSlug || '租户'} · 公开图鉴`,
      feedSubtitle: normalizeNullableString(form.feedSubtitle) ?? `${tenantSlug || '租户'} 在库产品展示`,
      brandPrimary: normalizeColor(form.brandPrimary) ?? '#FFD400',
      brandSecondary: normalizeColor(form.brandSecondary) ?? '#1f2937',
      heroImages: heroImages.length > 0 ? heroImages : [DEFAULT_HERO_IMAGE],
      showWechatBlock: form.showWechatBlock,
      wechatQrImageUrl: normalizeNullableString(form.wechatQrImageUrl),
      wechatId: normalizeNullableString(form.wechatId)
    };
  }, [form, tenantSlug]);

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
          wechatId: normalizeNullableString(form.wechatId)
        }
      });

      const response = await apiRequest('/tenant-share-presentation', {
        method: 'PUT',
        body: request,
        requestSchema: updateTenantSharePresentationRequestSchema,
        responseSchema: updateTenantSharePresentationResponseSchema
      });

      setForm(toFormState(response.presentation));
      setMessage('已保存，公开分享页刷新后立即生效。');
    } catch (requestError) {
      setError(formatError(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-4 pb-8 sm:space-y-6">
      {loading ? (
        <Card className="rounded-3xl border-neutral-200/90 bg-white p-6">
          <CardContent className="p-0 text-sm text-neutral-600">正在加载分享展示...</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="rounded-3xl border-red-200 bg-red-50 p-6">
          <CardContent className="p-0 text-sm font-semibold text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {!loading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(360px,1fr)_minmax(320px,420px)]">
          <Card className="rounded-3xl border-neutral-200/90 bg-white">
            <CardHeader>
              <CardTitle>配置表单</CardTitle>
              <CardDescription>保存后直接生效，不需要重新发布。</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="feed-title">分享标题</Label>
                  <Input
                    id="feed-title"
                    value={form.feedTitle}
                    placeholder="留空将使用默认标题"
                    onChange={(event) => setForm((prev) => ({ ...prev, feedTitle: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feed-subtitle">分享副标题</Label>
                  <Textarea
                    id="feed-subtitle"
                    rows={2}
                    value={form.feedSubtitle}
                    placeholder="留空将使用默认副标题"
                    onChange={(event) => setForm((prev) => ({ ...prev, feedSubtitle: event.target.value }))}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <ThemeColorPicker
                    id="brand-primary"
                    label="主题主色"
                    value={form.brandPrimary}
                    fallback="#FFD400"
                    options={primaryColorOptions}
                    onChange={(nextColor) => setForm((prev) => ({ ...prev, brandPrimary: nextColor }))}
                  />
                  <ThemeColorPicker
                    id="brand-secondary"
                    label="主题辅色"
                    value={form.brandSecondary}
                    fallback="#1f2937"
                    options={secondaryColorOptions}
                    onChange={(nextColor) => setForm((prev) => ({ ...prev, brandSecondary: nextColor }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preview-image">预览封面图 URL（将作为轮播第一张）</Label>
                  <Input
                    id="preview-image"
                    value={form.previewImageUrl}
                    placeholder="/images/mg_04.jpg 或 https://example.com/cover.jpg"
                    onChange={(event) => setForm((prev) => ({ ...prev, previewImageUrl: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hero-images">顶部轮播图（每行一个 URL 或 /images 路径）</Label>
                  <Textarea
                    id="hero-images"
                    rows={4}
                    value={form.heroImagesText}
                    placeholder={'/images/mg_04.jpg\nhttps://example.com/hero-2.jpg'}
                    onChange={(event) => setForm((prev) => ({ ...prev, heroImagesText: event.target.value }))}
                  />
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-neutral-300"
                      checked={form.showWechatBlock}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          showWechatBlock: event.target.checked
                        }))
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium text-neutral-900">显示微信联系方式模块</span>
                      <span className="block text-xs text-neutral-600">开启后公开 feed/detail 都会展示联系方式卡片。</span>
                    </span>
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wechat-qr">微信二维码图片 URL</Label>
                  <Input
                    id="wechat-qr"
                    value={form.wechatQrImageUrl}
                    placeholder="用户自己上传后的图片地址"
                    onChange={(event) => setForm((prev) => ({ ...prev, wechatQrImageUrl: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wechat-id">微信号</Label>
                  <Input
                    id="wechat-id"
                    value={form.wechatId}
                    placeholder="可选，便于用户手动添加"
                    onChange={(event) => setForm((prev) => ({ ...prev, wechatId: event.target.value }))}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? '保存中...' : '保存并立即生效'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => {
                      setForm(DEFAULT_FORM);
                      setMessage(null);
                      setError(null);
                    }}
                  >
                    清空表单
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-neutral-200/90 bg-white">
            <CardHeader>
              <CardTitle>实时预览</CardTitle>
              <CardDescription>这里是公开页的简化预览。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
                <div className="relative h-44">
                  <img src={preview.heroImages[0]} alt="分享封面预览" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/50" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/75">preview</p>
                    <h3 className="mt-1 text-xl font-semibold">{preview.feedTitle}</h3>
                    <p className="mt-1 text-sm text-white/85">{preview.feedSubtitle}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-neutral-200 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Primary</p>
                  <div className="mt-2 h-10 rounded-xl" style={{ backgroundColor: preview.brandPrimary }} />
                </div>
                <div className="rounded-2xl border border-neutral-200 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Secondary</p>
                  <div className="mt-2 h-10 rounded-xl" style={{ backgroundColor: preview.brandSecondary }} />
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">主题应用预览</p>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: preview.brandPrimary,
                      color: getContrastTextColor(preview.brandPrimary)
                    }}
                  >
                    主题标签
                  </span>
                  <span
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{
                      backgroundColor: preview.brandSecondary,
                      color: getContrastTextColor(preview.brandSecondary)
                    }}
                  >
                    示例按钮
                  </span>
                </div>
              </div>

              {preview.showWechatBlock ? (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Wechat Contact</p>
                  <div className="mt-3 flex items-start gap-3">
                    {preview.wechatQrImageUrl ? (
                      <img
                        src={preview.wechatQrImageUrl}
                        alt="微信二维码预览"
                        className="h-20 w-20 rounded-xl border border-neutral-200 bg-white object-cover p-1"
                      />
                    ) : null}
                    <div className="text-sm text-neutral-700">
                      {preview.wechatId ? (
                        <p>
                          微信号：<span className="font-mono font-medium">{preview.wechatId}</span>
                        </p>
                      ) : (
                        <p>未填写微信号</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-500">
                  微信联系方式模块当前为关闭状态。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {message ? (
        <Card className="rounded-3xl border-emerald-200 bg-emerald-50 p-4">
          <CardContent className="p-0 text-sm font-medium text-emerald-700">{message}</CardContent>
        </Card>
      ) : null}
    </main>
  );
}

type ThemeColorPickerProps = {
  id: string;
  label: string;
  value: string;
  fallback: string;
  options: ThemeColorOption[];
  onChange: (color: string) => void;
};

function ThemeColorPicker({ id, label, value, fallback, options, onChange }: ThemeColorPickerProps) {
  const resolvedColor = normalizeColor(value) ?? fallback;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const active = option.value.toLowerCase() === resolvedColor.toLowerCase();

          return (
            <button
              key={`${label}-${option.value}`}
              type="button"
              aria-pressed={active}
              className={`rounded-xl border px-2 py-2 text-left transition ${
                active ? 'shadow-[0_6px_16px_rgba(15,23,42,0.12)]' : 'hover:border-neutral-400'
              }`}
              style={{
                backgroundColor: active ? '#fff7d0' : '#ffffff',
                color: '#111827',
                borderColor: active ? option.value : '#e5e7eb'
              }}
              onClick={() => onChange(option.value)}
            >
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: option.value }} />
                <span className="truncate text-xs font-semibold text-neutral-800">{option.label}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
        <input
          id={id}
          type="color"
          value={resolvedColor}
          className="h-8 w-10 cursor-pointer rounded-md border border-neutral-300 bg-white p-0"
          aria-label={`${label} 自定义颜色`}
          onChange={(event) => onChange(event.target.value)}
        />
        <Label htmlFor={id} className="text-xs text-neutral-600">
          自定义颜色
        </Label>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-neutral-600">
          <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: resolvedColor }} />
          当前已选
        </div>
      </div>
    </div>
  );
}

function withCurrentColorOption(options: ThemeColorOption[], currentColor: string | null): ThemeColorOption[] {
  if (!currentColor) {
    return options;
  }

  const hasCurrent = options.some((option) => option.value.toLowerCase() === currentColor.toLowerCase());
  if (hasCurrent) {
    return options;
  }

  return [{ label: '当前色', value: currentColor }, ...options];
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
    wechatId: presentation.wechatId ?? ''
  };
}

function buildHeroImages(previewImageUrl: string, heroImagesText: string): string[] {
  const previewImage = normalizeNullableString(previewImageUrl);
  const heroImages = splitLines(heroImagesText);

  if (!previewImage) {
    return heroImages;
  }

  return [previewImage, ...heroImages.filter((item) => item !== previewImage)];
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

function getContrastTextColor(color: string): '#111827' | '#ffffff' {
  const normalized = normalizeColor(color);
  if (!normalized) {
    return '#111827';
  }

  const hex = normalized.length === 4
    ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
    : normalized;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness >= 150 ? '#111827' : '#ffffff';
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
