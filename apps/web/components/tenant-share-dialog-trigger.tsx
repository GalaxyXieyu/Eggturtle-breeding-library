'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Copy, QrCode, Share2, Sparkles, X } from 'lucide-react';
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
      return;
    }

    const sessionId = openSessionIdRef.current;
    const requestId = posterRequestIdRef.current + 1;
    posterRequestIdRef.current = requestId;

    void (async () => {
      setPosterPending(true);

      try {
        const dataUrl = await generateSharePoster({
          title: cardTitle,
          subtitle: cardSubtitle,
          qrDataUrl,
          previewImageUrl: normalizedPreviewImageUrl,
          posterImageUrls: normalizedPosterImageUrls,
          variant: resolvedPosterVariant,
        });

        if (
          !mountedRef.current ||
          openSessionIdRef.current !== sessionId ||
          posterRequestIdRef.current !== requestId
        ) {
          return;
        }

        setPosterDataUrl(dataUrl);
      } catch {
        if (
          !mountedRef.current ||
          openSessionIdRef.current !== sessionId ||
          posterRequestIdRef.current !== requestId
        ) {
          return;
        }

        setPosterDataUrl(null);
      } finally {
        if (
          mountedRef.current &&
          openSessionIdRef.current === sessionId &&
          posterRequestIdRef.current === requestId
        ) {
          setPosterPending(false);
        }
      }
    })();
  }, [
    cardSubtitle,
    cardTitle,
    normalizedPosterImageUrls,
    open,
    normalizedPreviewImageUrl,
    qrDataUrl,
    resolvedPosterVariant,
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

  function handleRetryShareLink() {
    if (!open || pending) {
      return;
    }

    setNotice(null);
    resetPreviewState();
    const sessionId = openSessionIdRef.current;
    void prepareShareAssets(sessionId);
  }

  return (
    <>
      {trigger({ onClick: handleOpen, pending })}

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-2 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={handleClose}
        >
          <div
            className={cn(
              'flex max-h-[min(96dvh,920px)] w-full max-w-[min(96vw,25rem)] flex-col overflow-hidden rounded-[26px] border border-black/10 bg-white p-3 shadow-2xl sm:max-h-[min(88vh,920px)] sm:max-w-[min(88vw,34rem)] sm:rounded-[28px] sm:p-4 dark:border-white/10 dark:bg-neutral-900',
              className,
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2.5 flex items-start justify-between gap-3 sm:mb-3">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 sm:text-[11px]">
                  <Sparkles size={12} />
                  Share
                </p>
                <p
                  id={titleId}
                  className="mt-1.5 line-clamp-1 text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 sm:mt-2 sm:text-base"
                >
                  {cardTitle}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400 sm:text-xs">
                  {intentCopy.body}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭分享弹窗"
                className={modalCloseButtonClass}
                onClick={handleClose}
              >
                <X size={17} strokeWidth={2.6} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2.5 sm:gap-3">
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-neutral-100 p-1.5 dark:border-white/10 dark:bg-neutral-950/60 sm:p-2">
                {pending ? (
                  <div className="mx-auto flex aspect-[9/16] w-full max-w-[15.75rem] min-h-[17.5rem] items-center justify-center rounded-[22px] bg-white text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400 sm:max-w-[18.5rem]">
                    正在生成分享链接...
                  </div>
                ) : posterDataUrl ? (
                  <div className="mx-auto flex aspect-[9/16] w-full max-w-[15.75rem] items-center justify-center rounded-[22px] bg-white p-1.5 shadow-[0_14px_30px_rgba(0,0,0,0.18)] sm:max-w-[18.5rem] sm:p-2">
                    <img
                      src={posterDataUrl}
                      alt="分享卡片预览"
                      className="h-full w-full rounded-[18px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="mx-auto flex aspect-[9/16] w-full max-w-[15.75rem] min-h-[17.5rem] flex-col items-center justify-center gap-3 rounded-[22px] bg-white px-6 text-center text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400 sm:max-w-[18.5rem]">
                    <QrCode size={28} />
                    暂无卡片预览
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-black/5 bg-neutral-50 p-2.5 dark:border-white/10 dark:bg-neutral-950/50 sm:p-3">
                <div className="flex items-center gap-2.5 sm:gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white sm:h-[4.5rem] sm:w-[4.5rem]">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt="分享二维码" className="h-full w-full object-cover" />
                    ) : (
                      <QrCode size={20} className="text-neutral-400 sm:h-[22px] sm:w-[22px]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      手机海报优先分享
                      {posterPending ? (
                        <span className="ml-2 text-[11px] font-medium text-neutral-400 dark:text-neutral-500 sm:text-xs">
                          海报生成中...
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400 sm:mt-1 sm:text-xs">
                      {cardSubtitle}
                    </p>
                  </div>
                </div>
                <p className="mt-2 break-all rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] leading-4 text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200 sm:text-xs">
                  {link || '链接生成中...'}
                </p>
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400 sm:text-xs">
                  {intentCopy.hint}
                </p>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                disabled={!link}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100"
              >
                <Copy size={15} />
                复制链接
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-[#FFD400] dark:text-neutral-900 dark:hover:bg-[#f1ca00]"
              >
                <Share2 size={15} />
                完成
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

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#0b1220');
  background.addColorStop(0.58, '#182235');
  background.addColorStop(1, '#0f172a');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawGlowCircle(ctx, width * 0.88, 180, 340, 'rgba(255,212,0,0.24)');
  drawGlowCircle(ctx, 140, height - 160, 280, 'rgba(250,204,21,0.16)');

  const cardX = 60;
  const cardY = 60;
  const cardWidth = width - 120;
  const cardHeight = height - 120;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.32)';
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 24;
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fill();
  ctx.restore();

  const heroX = cardX + 42;
  const heroY = cardY + 42;
  const heroWidth = cardWidth - 84;
  const heroHeight = 860;
  await drawGenericPosterHero(ctx, payload, heroX, heroY, heroWidth, heroHeight);

  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.font = '700 30px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('PUBLIC SHARE', heroX + 24, heroY + 48);

  drawMultilineText(ctx, payload.title, {
    x: heroX,
    y: heroY + heroHeight + 74,
    maxWidth: heroWidth,
    lineHeight: 70,
    maxLines: 2,
    font: '700 60px "Segoe UI", "PingFang SC", sans-serif',
    color: '#111827',
  });

  drawMultilineText(ctx, payload.subtitle, {
    x: heroX,
    y: heroY + heroHeight + 226,
    maxWidth: heroWidth,
    lineHeight: 44,
    maxLines: 3,
    font: '500 32px "Segoe UI", "PingFang SC", sans-serif',
    color: '#475569',
  });

  const qrPanelX = heroX;
  const qrPanelY = cardY + cardHeight - 372;
  const qrPanelWidth = heroWidth;
  const qrPanelHeight = 286;

  ctx.fillStyle = '#f8fafc';
  roundedRect(ctx, qrPanelX, qrPanelY, qrPanelWidth, qrPanelHeight, 30);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,212,0,0.34)';
  ctx.lineWidth = 3;
  roundedRect(ctx, qrPanelX, qrPanelY, qrPanelWidth, qrPanelHeight, 30);
  ctx.stroke();

  const qrX = qrPanelX + 34;
  const qrY = qrPanelY + 30;
  const qrSize = 192;

  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 20);
  ctx.fill();

  const qrImage = await loadImage(payload.qrDataUrl);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#111827';
  ctx.font = '700 38px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('扫码查看公开页', qrX + qrSize + 34, qrY + 58);
  ctx.font = '500 28px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('多图拼图保留，转发时更像真实在售池', qrX + qrSize + 34, qrY + 112);
  ctx.fillText('二维码、海报和链接统一复用分享链路', qrX + qrSize + 34, qrY + 156);

  ctx.fillStyle = '#0f172a';
  ctx.font = '500 22px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText(
    'Generated by Eggturtle Breeding Library',
    qrPanelX + 34,
    qrPanelY + qrPanelHeight - 26,
  );

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

  const imageX = 56;
  const imageY = 56;
  const imageWidth = width - 112;
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
  ctx.font = '700 30px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('DETAIL SHARE', imageX + 32, imageY + 48);

  drawMultilineText(ctx, payload.title, {
    x: imageX + 32,
    y: imageY + imageHeight - 230,
    maxWidth: imageWidth - 64,
    lineHeight: 70,
    maxLines: 2,
    font: '700 60px "Segoe UI", "PingFang SC", sans-serif',
    color: '#ffffff',
  });

  drawMultilineText(ctx, payload.subtitle, {
    x: imageX + 32,
    y: imageY + imageHeight - 98,
    maxWidth: imageWidth - 64,
    lineHeight: 42,
    maxLines: 2,
    font: '500 30px "Segoe UI", "PingFang SC", sans-serif',
    color: 'rgba(255,255,255,0.86)',
  });

  const panelX = 56;
  const panelY = imageY + imageHeight + 28;
  const panelWidth = width - 112;
  const panelHeight = height - panelY - 56;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 36);
  ctx.fill();

  const qrSize = 196;
  const qrX = panelX + 34;
  const qrY = panelY + 30;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 20);
  ctx.fill();

  const qrImage = await loadImage(payload.qrDataUrl);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#111827';
  ctx.font = '700 36px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('扫码直达当前详情', qrX + qrSize + 34, qrY + 56);
  ctx.font = '500 28px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('详情首图继续作为分享主视觉，适合直接发客户', qrX + qrSize + 34, qrY + 108);
  ctx.fillText('二维码、海报和复制链接仍共用统一分享 token', qrX + qrSize + 34, qrY + 152);

  ctx.fillStyle = '#0f172a';
  ctx.font = '500 22px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('Generated by Eggturtle Breeding Library', panelX + 34, panelY + panelHeight - 24);

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

  drawPosterCollage(ctx, images, x, y, width, height);
}

function drawPosterCollage(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const layouts = [
    { x: 0, y: 92, width: 0.44, height: 0.76, rotate: -0.12 },
    { x: 0.2, y: 18, width: 0.32, height: 0.54, rotate: -0.04 },
    { x: 0.47, y: 96, width: 0.28, height: 0.62, rotate: 0.06 },
    { x: 0.68, y: 28, width: 0.28, height: 0.5, rotate: 0.14 },
    { x: 0.68, y: 306, width: 0.23, height: 0.38, rotate: -0.08 },
  ];

  const heroGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  heroGradient.addColorStop(0, '#10213a');
  heroGradient.addColorStop(1, '#22324d');
  ctx.fillStyle = heroGradient;
  roundedRect(ctx, x, y, width, height, 30);
  ctx.fill();

  ctx.save();
  roundedRect(ctx, x, y, width, height, 30);
  ctx.clip();

  layouts.slice(0, images.length).forEach((layout, index) => {
    const cardWidth = width * layout.width;
    const cardHeight = height * layout.height;
    const cardX = x + width * layout.x;
    const cardY = y + layout.y;
    drawTiltedImageCard(ctx, images[index]!, cardX, cardY, cardWidth, cardHeight, layout.rotate);
  });

  const overlay = ctx.createLinearGradient(0, y + height * 0.4, 0, y + height);
  overlay.addColorStop(0, 'rgba(15,23,42,0.06)');
  overlay.addColorStop(0.6, 'rgba(15,23,42,0.38)');
  overlay.addColorStop(1, 'rgba(15,23,42,0.82)');
  ctx.fillStyle = overlay;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function drawTiltedImageCard(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  rotate: number,
) {
  const radius = 26;
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotate);
  ctx.shadowColor = 'rgba(15,23,42,0.28)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundedRect(ctx, -width / 2, -height / 2, width, height, radius + 4);
  ctx.fill();
  drawCoverImage(ctx, image, -width / 2, -height / 2, width, height, radius);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  roundedRect(ctx, -width / 2, -height / 2, width, height, radius);
  ctx.stroke();
  ctx.restore();
}

async function loadImages(urls: string[]) {
  const results = await Promise.allSettled(urls.map((url) => loadImage(url)));
  return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
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
  heroGradient.addColorStop(0, '#ffe18a');
  heroGradient.addColorStop(0.5, '#f59e0b');
  heroGradient.addColorStop(1, '#1f2937');

  ctx.fillStyle = heroGradient;
  roundedRect(ctx, x, y, width, height, 30);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 6; index += 1) {
    const offset = 32 + index * 48;
    ctx.beginPath();
    ctx.moveTo(x + offset, y + 24);
    ctx.lineTo(x + offset + 260, y + height - 24);
    ctx.stroke();
  }
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
    const timeoutId = window.setTimeout(() => reject(new Error('image load timeout')), 5000);
    const resolvedSrc = resolvePosterImageSource(src);

    image.decoding = 'async';
    if (!resolvedSrc.startsWith('data:') && !isSameOriginUrl(resolvedSrc)) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => {
      window.clearTimeout(timeoutId);
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
