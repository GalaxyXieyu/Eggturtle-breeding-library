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

export default function SharePresentationPage() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = useMemo(() => params.tenantSlug ?? '', [params.tenantSlug]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

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
      <Card className="rounded-2xl border-neutral-200/90 bg-white/90 p-4">
        <p className="text-sm text-neutral-600">配置公开 feed/detail 的标题文案、主题色、顶部轮播图和微信联系方式。</p>
      </Card>

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
                  <div className="space-y-2">
                    <Label htmlFor="brand-primary">主题主色</Label>
                    <Input
                      id="brand-primary"
                      value={form.brandPrimary}
                      placeholder="#FFD400"
                      onChange={(event) => setForm((prev) => ({ ...prev, brandPrimary: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brand-secondary">主题辅色</Label>
                    <Input
                      id="brand-secondary"
                      value={form.brandSecondary}
                      placeholder="#1f2937"
                      onChange={(event) => setForm((prev) => ({ ...prev, brandSecondary: event.target.value }))}
                    />
                  </div>
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

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知错误';
}
