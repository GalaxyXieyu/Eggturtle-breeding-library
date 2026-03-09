'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Copy, Download, QrCode, Share2, Sparkles, X } from 'lucide-react';
import QRCode from 'qrcode';

import { copyTextWithFallback } from '@/lib/browser-share';
import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import {
  createTenantFeedShareLink,
  getTenantShareIntentKey,
  getTenantShareDialogCopy,
  type TenantShareIntent,
  type TenantSharePosterVariant,
} from '@/lib/tenant-share';
import { cn } from '@/lib/utils';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';

type TenantShareDialogTriggerProps = {
  intent?: TenantShareIntent;
  trigger: (props: { onClick: () => void; pending: boolean }) => ReactNode;
  title?: string;
  subtitle?: string;
  previewImageUrl?: string | null;
  posterImageUrls?: string[];
  posterVariant?: TenantSharePosterVariant;
  missingTenantMessage?: string;
  className?: string;
};

export default function TenantShareDialogTrigger({
  intent = 'feed',
  trigger,
  title,
  subtitle,
  previewImageUrl,
  posterImageUrls,
  posterVariant,
  missingTenantMessage = '当前用户上下文未就绪，暂时无法生成分享链接。',
  className,
}: TenantShareDialogTriggerProps) {
  const intentKey = useMemo(() => getTenantShareIntentKey(intent), [intent]);
  const normalizedIntent = useMemo<TenantShareIntent>(() => {
    if (intentKey === 'feed' || intentKey === 'series') {
      return intentKey;
    }

    return { productId: intentKey.slice('product:'.length) };
  }, [intentKey]);
  const intentCopy = useMemo(() => getTenantShareDialogCopy(normalizedIntent), [normalizedIntent]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [posterPending, setPosterPending] = useState(false);
  const [posterRetrySeed, setPosterRetrySeed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const shareRequestIdRef = useRef(0);
  const shareAbortControllerRef = useRef<AbortController | null>(null);
  const posterRequestIdRef = useRef(0);
  const openSessionIdRef = useRef(0);
  const mountedRef = useRef(true);
  const titleId = useId();

  const cardTitle = useMemo(() => title?.trim() || intentCopy.title, [intentCopy.title, title]);
  const cardSubtitle = useMemo(
    () => subtitle?.trim() || intentCopy.subtitle,
    [intentCopy.subtitle, subtitle],
  );
  const normalizedPreviewImageUrl = useMemo(
    () => (previewImageUrl?.trim() ? resolveAuthenticatedAssetUrl(previewImageUrl) : null),
    [previewImageUrl],
  );
  const normalizedPosterImageUrls = useMemo(
    () =>
      Array.from(
        new Set(
          (posterImageUrls ?? [])
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => resolveAuthenticatedAssetUrl(item)),
        ),
      ),
    [posterImageUrls],
  );

  const resolvedPosterVariant = useMemo<TenantSharePosterVariant>(() => {
    if (posterVariant) {
      return posterVariant;
    }

    return typeof normalizedIntent === 'object' ? 'detail' : 'generic';
  }, [normalizedIntent, posterVariant]);

  const cancelShareRequest = useCallback(() => {
    shareAbortControllerRef.current?.abort();
    shareAbortControllerRef.current = null;
  }, []);

  const resetPreviewState = useCallback(() => {
    cancelShareRequest();
    shareRequestIdRef.current += 1;
    posterRequestIdRef.current += 1;
    setPending(false);
    setLink('');
    setQrDataUrl(null);
    setPosterDataUrl(null);
    setPosterPending(false);
    setPosterRetrySeed(0);
    setError(null);
  }, [cancelShareRequest]);

  const handleClose = useCallback(() => {
    openSessionIdRef.current += 1;
    resetPreviewState();
    setNotice(null);
    setOpen(false);
  }, [resetPreviewState]);

  const prepareShareAssets = useCallback(
    async (sessionId: number) => {
      const requestId = shareRequestIdRef.current + 1;
      shareRequestIdRef.current = requestId;
      cancelShareRequest();
      const abortController = new AbortController();
      shareAbortControllerRef.current = abortController;
      setPending(true);
      setError(null);

      try {
        const share = await createTenantFeedShareLink({
          intent: normalizedIntent,
          missingTenantMessage,
          signal: abortController.signal,
        });

        if (
          !mountedRef.current ||
          openSessionIdRef.current !== sessionId ||
          shareRequestIdRef.current !== requestId
        ) {
          return;
        }

        setLink(share.permanentUrl);
      } catch (currentError) {
        if (abortController.signal.aborted) {
          return;
        }

        if (
          !mountedRef.current ||
          openSessionIdRef.current !== sessionId ||
          shareRequestIdRef.current !== requestId
        ) {
          return;
        }

        setError(formatApiError(currentError, '创建分享链接失败'));
      } finally {
        if (shareAbortControllerRef.current === abortController) {
          shareAbortControllerRef.current = null;
        }

        if (
          mountedRef.current &&
          openSessionIdRef.current === sessionId &&
          shareRequestIdRef.current === requestId
        ) {
          setPending(false);
        }
      }
    },
    [cancelShareRequest, missingTenantMessage, normalizedIntent],
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancelShareRequest();
      openSessionIdRef.current += 1;
      shareRequestIdRef.current += 1;
      posterRequestIdRef.current += 1;
    };
  }, [cancelShareRequest]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!open) {
      return;
    }

    resetPreviewState();
    setNotice(null);
    const sessionId = openSessionIdRef.current;
    void prepareShareAssets(sessionId);
  }, [intentKey, open, prepareShareAssets, resetPreviewState]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, open]);

  useEffect(() => {
    const currentLink = link.trim();
    if (!currentLink) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(currentLink, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'H',
        });

        if (!cancelled && mountedRef.current) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled && mountedRef.current) {
          setQrDataUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [link]);

  useEffect(() => {
    if (!open || !qrDataUrl) {
      setPosterPending(false);
      return;
    }

    const sessionId = openSessionIdRef.current;
    const requestId = posterRequestIdRef.current + 1;
    posterRequestIdRef.current = requestId;
    setPosterPending(true);
    setPosterDataUrl(null);
    setError((previousError) =>
      previousError?.startsWith('海报') ? null : previousError,
    );

    const posterPayload: SharePosterPayload = {
      title: cardTitle,
      subtitle: cardSubtitle,
      qrDataUrl,
      previewImageUrl: normalizedPreviewImageUrl,
      posterImageUrls: normalizedPosterImageUrls,
      variant: resolvedPosterVariant,
    };

    void (async () => {
      const attemptPayloads: SharePosterPayload[] = [posterPayload, posterPayload];
      if (
        posterPayload.previewImageUrl ||
        (posterPayload.posterImageUrls?.length ?? 0) > 0
      ) {
        attemptPayloads.push({
          ...posterPayload,
          previewImageUrl: null,
          posterImageUrls: [],
        });
      }

      for (let attemptIndex = 0; attemptIndex < attemptPayloads.length; attemptIndex += 1) {
        try {
          const dataUrl = await generateSharePoster(attemptPayloads[attemptIndex]!);

          if (
            !mountedRef.current ||
            openSessionIdRef.current !== sessionId ||
            posterRequestIdRef.current !== requestId
          ) {
            return;
          }

          setPosterDataUrl(dataUrl);
          setPosterPending(false);
          return;
        } catch {
          if (attemptIndex < attemptPayloads.length - 1) {
            await wait(180 * (attemptIndex + 1));
          }
        }
      }

      if (
        !mountedRef.current ||
        openSessionIdRef.current !== sessionId ||
        posterRequestIdRef.current !== requestId
      ) {
        return;
      }

      setPosterDataUrl(null);
      setPosterPending(false);
      setError('海报生成失败，请点击重试。');
    })();
  }, [
    cardSubtitle,
    cardTitle,
    normalizedPosterImageUrls,
    open,
    normalizedPreviewImageUrl,
    qrDataUrl,
    resolvedPosterVariant,
    posterRetrySeed,
  ]);

  function handleOpen() {
    if (open) {
      return;
    }

    openSessionIdRef.current += 1;
    resetPreviewState();
    setNotice(null);
    setOpen(true);
  }

  async function handleCopyLink() {
    if (!link) {
      setError('分享链接尚未生成，请稍后再试。');
      return;
    }

    const copied = await copyTextWithFallback(link);
    if (copied) {
      setError(null);
      setNotice('已复制分享链接。');
      return;
    }

    setError('复制失败，请手动复制当前链接。');
  }

  function handleSaveImage() {
    if (posterPending) {
      setError('海报正在生成，请稍后再试。');
      return;
    }

    if (!posterDataUrl) {
      setError('海报尚未生成完成，请稍后再试。');
      return;
    }

    try {
      const fileBase = cardTitle.replace(/[^\w\u4e00-\u9fa5-]+/g, '').slice(0, 24) || 'eggturtle-share';
      const fileName = `${fileBase}.png`;
      const anchor = document.createElement('a');
      anchor.href = posterDataUrl;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setError(null);
      setNotice('海报已开始下载。');
    } catch {
      setError('保存失败，请长按海报图片手动保存。');
    }
  }

  function handleRetryShareLink() {
    if (!open || pending || posterPending) {
      return;
    }

    setNotice(null);
    setError(null);
    if (link.trim() && qrDataUrl) {
      posterRequestIdRef.current += 1;
      setPosterDataUrl(null);
      setPosterRetrySeed((previous) => previous + 1);
      return;
    }

    resetPreviewState();
    const sessionId = openSessionIdRef.current;
    void prepareShareAssets(sessionId);
  }

  return (
    <>
      {trigger({ onClick: handleOpen, pending })}

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={handleClose}
        >
          <div
            className={cn(
              'relative flex max-h-[min(96dvh,920px)] w-full max-w-[min(96vw,26rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-2xl sm:max-h-[min(88vh,920px)] sm:max-w-[min(88vw,36rem)] sm:rounded-[32px] sm:p-5',
              className,
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative z-10 mb-3 flex items-start justify-between gap-3 sm:mb-4">
              <div className="min-w-0 space-y-1.5">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600 sm:text-[11px]">
                  <Share2 size={12} />
                  分享
                </p>
                <p
                  id={titleId}
                  className="line-clamp-1 text-lg font-bold tracking-tight sm:text-xl"
                >
                  {cardTitle}
                </p>
                <p className="line-clamp-2 text-xs leading-relaxed text-neutral-500 sm:text-sm">
                  {intentCopy.body}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭分享弹窗"
                className={modalCloseButtonClass}
                onClick={handleClose}
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-2 sm:py-3">
              <div className="flex h-full min-h-[min(62dvh,32rem)] w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:min-h-[min(72vh,42rem)] sm:rounded-3xl sm:p-4">
                {pending ? (
                  <div className="mx-auto flex aspect-[9/16] w-full max-w-[min(84vw,19rem)] min-h-[17.5rem] flex-col items-center justify-center gap-4 rounded-2xl bg-white text-sm text-neutral-600 shadow-sm sm:max-w-[19rem]">
                    <span className="inline-flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-neutral-900 text-[#FFD400]">
                      <Share2 size={18} />
                    </span>
                    正在生成分享链接...
                  </div>
                ) : posterPending ? (
                  <div className="mx-auto flex aspect-[9/16] w-full max-w-[min(84vw,19rem)] min-h-[17.5rem] flex-col items-center justify-center gap-4 rounded-2xl bg-white text-sm text-neutral-600 shadow-sm sm:max-w-[19rem]">
                    <span className="inline-flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-neutral-900 text-[#FFD400]">
                      <QrCode size={20} />
                    </span>
                    正在渲染分享海报...
                  </div>
                ) : posterDataUrl ? (
                  <div className="mx-auto flex aspect-[9/16] w-full max-w-[min(84vw,19rem)] items-center justify-center rounded-2xl bg-neutral-900 p-1 shadow-xl sm:max-w-[19rem]">
                    <img
                      src={posterDataUrl}
                      alt="分享卡片预览"
                      className="h-full w-full rounded-xl object-contain"
                    />
                  </div>
                ) : (
                  <div className="mx-auto flex aspect-[9/16] w-full max-w-[min(84vw,19rem)] min-h-[17.5rem] flex-col items-center justify-center gap-4 rounded-2xl bg-white px-6 text-center text-sm text-neutral-500 shadow-sm sm:max-w-[19rem]">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                      <QrCode size={24} />
                    </span>
                    暂无卡片预览
                  </div>
                )}
              </div>
            </div>

            <div className="relative z-10 mt-3 grid grid-cols-1 gap-2.5 sm:mt-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSaveImage}
                disabled={!posterDataUrl || posterPending}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} />
                保存图片
              </button>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                disabled={!link}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border-2 border-neutral-900 bg-white px-4 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy size={16} />
                复制链接
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="fixed left-4 right-4 z-[80] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/90 dark:text-red-200 sm:left-auto sm:right-6 sm:max-w-xs"
          role="alert"
        >
          {error}
          <button
            type="button"
            onClick={handleRetryShareLink}
            className="ml-2 font-semibold underline"
          >
            重试
          </button>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 font-semibold underline"
          >
            关闭
          </button>
        </div>
      ) : null}

      {notice ? (
        <div
          className="fixed left-4 right-4 z-[80] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200 sm:left-auto sm:right-6 sm:max-w-xs"
          role="status"
        >
          {notice}
        </div>
      ) : null}
    </>
  );
}

type SharePosterPayload = {
  title: string;
  subtitle: string;
  qrDataUrl: string;
  previewImageUrl?: string | null;
  posterImageUrls?: string[];
  variant: TenantSharePosterVariant;
};

async function generateSharePoster(payload: SharePosterPayload): Promise<string> {
  return payload.variant === 'detail'
    ? generateDetailSharePoster(payload)
    : generateGenericSharePoster(payload);
}

async function generateGenericSharePoster(payload: SharePosterPayload): Promise<string> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }

  // Modern gradient background (black to dark gray)
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#0a0a0a');
  background.addColorStop(0.5, '#1a1a1a');
  background.addColorStop(1, '#0f0f0f');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Subtle accent glow (yellow accent)
  drawGlowCircle(ctx, width * 0.85, 200, 400, 'rgba(255,212,0,0.12)');
  drawGlowCircle(ctx, 120, height - 200, 350, 'rgba(255,212,0,0.08)');

  const cardX = 50;
  const cardY = 50;
  const cardWidth = width - 100;
  const cardHeight = height - 100;

  // Main card with clean white background
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 48);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  const contentPadding = 48;
  const heroX = cardX + contentPadding;
  const heroY = cardY + contentPadding;
  const heroWidth = cardWidth - contentPadding * 2;
  const heroHeight = 800;

  // Draw hero image section
  await drawGenericPosterHero(ctx, payload, heroX, heroY, heroWidth, heroHeight);

  // Title section with more breathing room
  const titleY = heroY + heroHeight + 60;
  drawMultilineText(ctx, payload.title, {
    x: heroX,
    y: titleY,
    maxWidth: heroWidth,
    lineHeight: 68,
    maxLines: 2,
    font: '700 58px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: '#0a0a0a',
  });

  // Subtitle with better contrast
  drawMultilineText(ctx, payload.subtitle, {
    x: heroX,
    y: titleY + 150,
    maxWidth: heroWidth,
    lineHeight: 42,
    maxLines: 2,
    font: '500 28px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: '#666666',
  });

  // QR code section - cleaner layout
  const qrSectionY = cardY + cardHeight - 340;
  const qrSize = 200;
  const qrX = heroX;
  const qrY = qrSectionY;

  // QR code with subtle border
  ctx.fillStyle = '#f5f5f5';
  roundedRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 24);
  ctx.fill();

  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 2;
  roundedRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 24);
  ctx.stroke();

  const qrImage = await loadImage(payload.qrDataUrl);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  // QR text section - simplified
  const qrTextX = qrX + qrSize + 40;
  ctx.fillStyle = '#0a0a0a';
  ctx.font = '700 36px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('扫码查看', qrTextX, qrY + 60);

  ctx.fillStyle = '#666666';
  ctx.font = '500 24px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('分享链接与二维码同源', qrTextX, qrY + 110);
  ctx.fillText('可直接转发或复制链接', qrTextX, qrY + 150);

  // Bottom accent bar with yellow
  const accentBarY = qrY + qrSize + 40;
  const accentBarHeight = 6;
  const accentGradient = ctx.createLinearGradient(heroX, accentBarY, heroX + heroWidth, accentBarY);
  accentGradient.addColorStop(0, '#FFD400');
  accentGradient.addColorStop(0.5, '#FFC700');
  accentGradient.addColorStop(1, '#FFD400');
  ctx.fillStyle = accentGradient;
  roundedRect(ctx, heroX, accentBarY, heroWidth, accentBarHeight, 3);
  ctx.fill();

  // Footer text
  ctx.fillStyle = '#999999';
  ctx.font = '500 20px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('Eggturtle Breeding Library', heroX, accentBarY + 50);

  return canvas.toDataURL('image/png');
}

async function generateDetailSharePoster(payload: SharePosterPayload): Promise<string> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#0f172a');
  background.addColorStop(0.5, '#111827');
  background.addColorStop(1, '#1f2937');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawGlowCircle(ctx, width - 120, 160, 280, 'rgba(255,212,0,0.20)');
  drawGlowCircle(ctx, 180, height - 120, 240, 'rgba(255,255,255,0.08)');

  const imageX = 34;
  const imageY = 34;
  const imageWidth = width - 68;
  const imageHeight = 1160;

  if (payload.previewImageUrl) {
    try {
      const heroImage = await loadImage(payload.previewImageUrl);
      drawCoverImage(ctx, heroImage, imageX, imageY, imageWidth, imageHeight, 44);
    } catch {
      drawHeroFallback(ctx, imageX, imageY, imageWidth, imageHeight);
    }
  } else {
    drawHeroFallback(ctx, imageX, imageY, imageWidth, imageHeight);
  }

  const imageOverlay = ctx.createLinearGradient(
    0,
    imageY + imageHeight * 0.32,
    0,
    imageY + imageHeight,
  );
  imageOverlay.addColorStop(0, 'rgba(15,23,42,0.04)');
  imageOverlay.addColorStop(0.55, 'rgba(15,23,42,0.42)');
  imageOverlay.addColorStop(1, 'rgba(15,23,42,0.82)');
  ctx.save();
  roundedRect(ctx, imageX, imageY, imageWidth, imageHeight, 44);
  ctx.clip();
  ctx.fillStyle = imageOverlay;
  ctx.fillRect(imageX, imageY, imageWidth, imageHeight);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = '700 30px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('DETAIL SHARE', imageX + 32, imageY + 48);

  drawMultilineText(ctx, payload.title, {
    x: imageX + 32,
    y: imageY + imageHeight - 230,
    maxWidth: imageWidth - 64,
    lineHeight: 70,
    maxLines: 2,
    font: '700 56px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: '#ffffff',
  });

  drawMultilineText(ctx, payload.subtitle, {
    x: imageX + 32,
    y: imageY + imageHeight - 98,
    maxWidth: imageWidth - 64,
    lineHeight: 42,
    maxLines: 2,
    font: '500 29px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: 'rgba(255,255,255,0.86)',
  });

  const panelX = 34;
  const panelY = imageY + imageHeight + 28;
  const panelWidth = width - 68;
  const panelHeight = height - panelY - 34;
  ctx.fillStyle = '#fff8eb';
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 36);
  ctx.fill();
  ctx.strokeStyle = 'rgba(217,119,6,0.28)';
  ctx.lineWidth = 3;
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 36);
  ctx.stroke();

  const qrSize = 196;
  const qrX = panelX + 34;
  const qrY = panelY + 30;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 20);
  ctx.fill();

  const qrImage = await loadImage(payload.qrDataUrl);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#111827';
  ctx.font = '700 35px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('扫码直达当前详情', qrX + qrSize + 34, qrY + 56);
  ctx.font = '500 25px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('当前种龟详情可一键直达，适合直接发客户', qrX + qrSize + 34, qrY + 104);
  ctx.fillText('二维码、海报与链接复用同一分享链路', qrX + qrSize + 34, qrY + 144);

  const dividerY = qrY + qrSize + 30;
  ctx.strokeStyle = 'rgba(180,83,9,0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(panelX + 34, dividerY);
  ctx.lineTo(panelX + panelWidth - 34, dividerY);
  ctx.stroke();

  const sloganCardX = panelX + 34;
  const sloganCardY = dividerY + 20;
  const sloganCardWidth = panelWidth - 68;
  const sloganCardHeight = 132;
  const sloganCardGradient = ctx.createLinearGradient(
    sloganCardX,
    sloganCardY,
    sloganCardX + sloganCardWidth,
    sloganCardY + sloganCardHeight,
  );
  sloganCardGradient.addColorStop(0, 'rgba(253,230,138,0.78)');
  sloganCardGradient.addColorStop(1, 'rgba(251,191,36,0.28)');
  ctx.fillStyle = sloganCardGradient;
  roundedRect(ctx, sloganCardX, sloganCardY, sloganCardWidth, sloganCardHeight, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(146,64,14,0.28)';
  ctx.lineWidth = 2;
  roundedRect(ctx, sloganCardX, sloganCardY, sloganCardWidth, sloganCardHeight, 24);
  ctx.stroke();

  ctx.fillStyle = '#7c2d12';
  ctx.font = '700 34px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('好龟看得见，成交更直接', sloganCardX + 28, sloganCardY + 52);
  ctx.fillStyle = '#92400e';
  ctx.font = '500 22px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText(
    'SLOGAN · Better genetics, better trust, better sales.',
    sloganCardX + 28,
    sloganCardY + 92,
  );

  const chipY = sloganCardY + sloganCardHeight + 20;
  const chipGap = 16;
  const chipHeight = 90;
  const chipWidth = (sloganCardWidth - chipGap * 2) / 3;
  drawPosterInfoChip(ctx, {
    x: sloganCardX,
    y: chipY,
    width: chipWidth,
    height: chipHeight,
    label: '分享链路',
    value: '图·码·链接同源',
    accentFrom: '#f59e0b',
    accentTo: '#fcd34d',
  });
  drawPosterInfoChip(ctx, {
    x: sloganCardX + chipWidth + chipGap,
    y: chipY,
    width: chipWidth,
    height: chipHeight,
    label: '客户决策',
    value: '先看图 再沟通',
    accentFrom: '#0f172a',
    accentTo: '#334155',
  });
  drawPosterInfoChip(ctx, {
    x: sloganCardX + (chipWidth + chipGap) * 2,
    y: chipY,
    width: chipWidth,
    height: chipHeight,
    label: '转发效率',
    value: '直达详情页',
    accentFrom: '#92400e',
    accentTo: '#d97706',
  });

  const accentY = chipY + chipHeight + 24;
  ctx.strokeStyle = 'rgba(120,53,15,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(panelX + 34, accentY);
  ctx.lineTo(panelX + panelWidth - 34, accentY);
  ctx.stroke();
  for (let index = 0; index < 3; index += 1) {
    const dotX = panelX + panelWidth / 2 + (index - 1) * 22;
    const dotRadius = index === 1 ? 4 : 3;
    ctx.fillStyle = index === 1 ? '#f59e0b' : '#fcd34d';
    ctx.beginPath();
    ctx.arc(dotX, accentY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#92400e';
  ctx.font = '500 20px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('A good card speaks before you do.', panelX + 34, panelY + panelHeight - 58);

  ctx.fillStyle = '#0f172a';
  ctx.font = '500 20px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('Eggturtle Breeding Library', panelX + 34, panelY + panelHeight - 24);

  return canvas.toDataURL('image/png');
}


async function drawGenericPosterHero(
  ctx: CanvasRenderingContext2D,
  payload: SharePosterPayload,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const imageUrls = Array.from(
    new Set([payload.previewImageUrl, ...(payload.posterImageUrls ?? [])].filter(Boolean)),
  ).slice(0, 5) as string[];

  if (imageUrls.length === 0) {
    drawHeroFallback(ctx, x, y, width, height);
    return;
  }

  const images = await loadImages(imageUrls);
  if (images.length === 0) {
    drawHeroFallback(ctx, x, y, width, height);
    return;
  }

  drawPosterCollage(ctx, ensureMasonryImages(images, 5), x, y, width, height);
}

function drawPosterCollage(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  // Clean background with subtle gradient
  const heroGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  heroGradient.addColorStop(0, '#f5f5f5');
  heroGradient.addColorStop(1, '#e5e5e5');
  ctx.fillStyle = heroGradient;
  roundedRect(ctx, x, y, width, height, 32);
  ctx.fill();

  // Add subtle border
  ctx.strokeStyle = '#d0d0d0';
  ctx.lineWidth = 2;
  roundedRect(ctx, x, y, width, height, 32);
  ctx.stroke();

  const padding = 6;
  const innerX = x + padding;
  const innerY = y + padding;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  ctx.save();
  roundedRect(ctx, x, y, width, height, 32);
  ctx.clip();

  // Simple grid layout: 2 columns
  const gap = 6;
  const mainWidth = innerWidth * 0.58;
  const sideWidth = innerWidth - mainWidth - gap;
  const mainHeight = innerHeight;

  // Main large image
  drawCoverImage(ctx, images[0]!, innerX, innerY, mainWidth, mainHeight, 20);

  // Subtle shadow on main image
  ctx.shadowColor = 'rgba(0,0,0,0.1)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  roundedRect(ctx, innerX, innerY, mainWidth, mainHeight, 20);
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Side images - 4 rows for more content
  const sideX = innerX + mainWidth + gap;
  const sideImageHeight = (mainHeight - gap * 3) / 4;

  // Draw up to 4 side images
  for (let i = 1; i < Math.min(images.length, 5); i++) {
    const imageY = innerY + (sideImageHeight + gap) * (i - 1);
    drawCoverImage(ctx, images[i]!, sideX, imageY, sideWidth, sideImageHeight, 14);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    roundedRect(ctx, sideX, imageY, sideWidth, sideImageHeight, 14);
    ctx.stroke();
  }

  ctx.restore();
}

type PosterInfoChipOptions = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: string;
  accentFrom: string;
  accentTo: string;
};

function drawPosterInfoChip(ctx: CanvasRenderingContext2D, options: PosterInfoChipOptions) {
  const chipGradient = ctx.createLinearGradient(
    options.x,
    options.y,
    options.x + options.width,
    options.y + options.height,
  );
  chipGradient.addColorStop(0, 'rgba(255,255,255,0.94)');
  chipGradient.addColorStop(1, 'rgba(255,247,224,0.94)');
  ctx.fillStyle = chipGradient;
  roundedRect(ctx, options.x, options.y, options.width, options.height, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(146,64,14,0.18)';
  ctx.lineWidth = 2;
  roundedRect(ctx, options.x, options.y, options.width, options.height, 18);
  ctx.stroke();

  const accentGradient = ctx.createLinearGradient(
    options.x + 12,
    options.y + 10,
    options.x + options.width - 12,
    options.y + 10,
  );
  accentGradient.addColorStop(0, options.accentFrom);
  accentGradient.addColorStop(1, options.accentTo);
  ctx.fillStyle = accentGradient;
  roundedRect(ctx, options.x + 12, options.y + 10, Math.max(64, options.width * 0.42), 6, 3);
  ctx.fill();

  ctx.fillStyle = '#7c2d12';
  ctx.font = '600 18px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText(options.label, options.x + 14, options.y + 40);
  drawMultilineText(ctx, options.value, {
    x: options.x + 14,
    y: options.y + 46,
    maxWidth: options.width - 28,
    lineHeight: 24,
    maxLines: 2,
    font: '700 23px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: '#111827',
  });
}

async function loadImages(urls: string[]) {
  const results = await Promise.allSettled(urls.map((url) => loadImage(url)));
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function ensureMasonryImages(images: HTMLImageElement[], minCount: number) {
  if (images.length >= minCount) {
    return images;
  }

  const filled = [...images];
  while (filled.length < minCount) {
    filled.push(images[filled.length % images.length]!);
  }

  return filled;
}

function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string,
) {
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeroFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const heroGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  heroGradient.addColorStop(0, '#1f2937');
  heroGradient.addColorStop(0.45, '#111827');
  heroGradient.addColorStop(1, '#78350f');

  ctx.fillStyle = heroGradient;
  roundedRect(ctx, x, y, width, height, 30);
  ctx.fill();

  ctx.save();
  roundedRect(ctx, x, y, width, height, 30);
  ctx.clip();

  drawGlowCircle(ctx, x + width * 0.9, y + 100, width * 0.42, 'rgba(250,204,21,0.32)');
  drawGlowCircle(ctx, x + 90, y + height - 80, width * 0.36, 'rgba(245,158,11,0.24)');

  for (let index = 0; index < 6; index += 1) {
    const lineY = y + 86 + index * 56;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 24, lineY);
    ctx.lineTo(x + width - 24, lineY + 20);
    ctx.stroke();
  }

  drawFallbackImageCard(ctx, x + width * 0.08, y + 136, width * 0.36, height * 0.52, -0.12, [
    '#fde68a',
    '#f59e0b',
  ]);
  drawFallbackImageCard(ctx, x + width * 0.37, y + 98, width * 0.35, height * 0.56, 0.04, [
    '#fef3c7',
    '#f59e0b',
  ]);
  drawFallbackImageCard(ctx, x + width * 0.66, y + 156, width * 0.27, height * 0.42, 0.15, [
    '#fbbf24',
    '#111827',
  ]);

  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = '700 56px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('蛋龟选育库', x + 38, y + height - 174);
  ctx.font = '500 28px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  ctx.fillText('暂无主图，也可直接分享入口', x + 38, y + height - 124);

  ctx.restore();
}

function drawFallbackImageCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  rotate: number,
  colors: [string, string],
) {
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotate);
  ctx.shadowColor = 'rgba(0,0,0,0.26)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 14;

  const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundedRect(ctx, -width / 2 - 4, -height / 2 - 4, width + 8, height + 8, 26);
  ctx.fill();

  ctx.fillStyle = gradient;
  roundedRect(ctx, -width / 2, -height / 2, width, height, 24);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 4;
  roundedRect(ctx, -width / 2, -height / 2, width, height, 24);
  ctx.stroke();

  ctx.fillStyle = 'rgba(17,24,39,0.36)';
  roundedRect(ctx, -width / 2 + 16, -height / 2 + 20, width - 32, 16, 8);
  ctx.fill();
  roundedRect(ctx, -width / 2 + 16, -height / 2 + 46, width - 48, 12, 6);
  ctx.fill();
  roundedRect(ctx, -width / 2 + 16, -height / 2 + 66, width - 64, 12, 6);
  ctx.fill();

  ctx.restore();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;

  let drawWidth = width;
  let drawHeight = height;
  let drawX = x;
  let drawY = y;

  if (imageRatio > targetRatio) {
    drawWidth = height * imageRatio;
    drawX = x - (drawWidth - width) / 2;
  } else {
    drawHeight = width / imageRatio;
    drawY = y - (drawHeight - height) / 2;
  }

  ctx.save();
  roundedRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.arcTo(x, y, x + safeRadius, y, safeRadius);
  ctx.closePath();
}

type TextBlockOptions = {
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  maxLines: number;
  font: string;
  color: string;
};

function drawMultilineText(ctx: CanvasRenderingContext2D, text: string, options: TextBlockOptions) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return;
  }

  ctx.save();
  ctx.font = options.font;
  ctx.fillStyle = options.color;
  ctx.textBaseline = 'top';

  const chars = Array.from(normalized);
  const lines: string[] = [];
  let current = '';

  for (const char of chars) {
    const candidate = `${current}${char}`;
    if (ctx.measureText(candidate).width <= options.maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (lines.length >= options.maxLines) {
      break;
    }

    current = char;
  }

  if (lines.length < options.maxLines && current) {
    lines.push(current);
  }

  if (lines.length === options.maxLines) {
    const lastIndex = lines.length - 1;
    let lastLine = lines[lastIndex] || '';
    while (lastLine && ctx.measureText(`${lastLine}…`).width > options.maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    lines[lastIndex] = `${lastLine}…`;
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, options.x, options.y + options.lineHeight * index);
  });

  ctx.restore();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => reject(new Error('image load timeout')), 9000);
    const resolvedSrc = resolvePosterImageSource(src);

    image.decoding = 'async';
    if (!resolvedSrc.startsWith('data:') && !isSameOriginUrl(resolvedSrc)) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      window.clearTimeout(timeoutId);
      if (typeof image.decode === 'function') {
        image
          .decode()
          .catch(() => undefined)
          .finally(() => resolve(image));
        return;
      }

      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('image load error'));
    };
    image.src = resolvedSrc;
  });
}

function resolvePosterImageSource(src: string): string {
  if (!src || src.startsWith('data:')) {
    return src;
  }

  try {
    const parsed = new URL(src, window.location.origin);
    const normalizedPath = parsed.pathname;
    const shouldUseProxy =
      /^\/products\/[^/]+\/images\/[^/]+\/content$/.test(normalizedPath) ||
      /^\/products\/[^/]+\/certificates\/[^/]+\/content$/.test(normalizedPath) ||
      /^\/products\/[^/]+\/couple-photos\/[^/]+\/content$/.test(normalizedPath);

    if (shouldUseProxy && !normalizedPath.startsWith('/api/proxy/')) {
      return `/api/proxy${normalizedPath}${parsed.search}${parsed.hash}`;
    }

    if (!/^https?:\/\//i.test(src)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return src;
  }
}

function isSameOriginUrl(src: string) {
  if (src.startsWith('/')) {
    return true;
  }

  try {
    return new URL(src, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}
