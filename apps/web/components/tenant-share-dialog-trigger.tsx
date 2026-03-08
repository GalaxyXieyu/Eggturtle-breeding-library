'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Copy, QrCode, Share2, Sparkles, X } from 'lucide-react';
import QRCode from 'qrcode';

import { copyTextWithFallback } from '@/lib/browser-share';
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
  const posterRequestIdRef = useRef(0);
  const openSessionIdRef = useRef(0);
  const mountedRef = useRef(true);
  const titleId = useId();

  const cardTitle = useMemo(() => title?.trim() || intentCopy.title, [intentCopy.title, title]);
  const cardSubtitle = useMemo(
    () => subtitle?.trim() || intentCopy.subtitle,
    [intentCopy.subtitle, subtitle],
  );
  const resolvedPosterVariant = useMemo<TenantSharePosterVariant>(() => {
    if (posterVariant) {
      return posterVariant;
    }

    return typeof normalizedIntent === 'object' ? 'detail' : 'generic';
  }, [normalizedIntent, posterVariant]);

  const resetPreviewState = useCallback(() => {
    shareRequestIdRef.current += 1;
    posterRequestIdRef.current += 1;
    setPending(false);
    setLink('');
    setQrDataUrl(null);
    setPosterDataUrl(null);
    setPosterPending(false);
    setError(null);
  }, []);

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
      setPending(true);
      setError(null);

      try {
        const share = await createTenantFeedShareLink({
          intent: normalizedIntent,
          missingTenantMessage,
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
        if (
          !mountedRef.current ||
          openSessionIdRef.current !== sessionId ||
          shareRequestIdRef.current !== requestId
        ) {
          return;
        }

        setError(formatApiError(currentError, '创建分享链接失败'));
      } finally {
        if (
          mountedRef.current &&
          openSessionIdRef.current === sessionId &&
          shareRequestIdRef.current === requestId
        ) {
          setPending(false);
        }
      }
    },
    [missingTenantMessage, normalizedIntent],
  );

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      openSessionIdRef.current += 1;
      shareRequestIdRef.current += 1;
      posterRequestIdRef.current += 1;
    };
  }, []);

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
          previewImageUrl,
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
  }, [cardSubtitle, cardTitle, open, previewImageUrl, qrDataUrl, resolvedPosterVariant]);

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

  return (
    <>
      {trigger({ onClick: handleOpen, pending })}

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={handleClose}
        >
          <div
            className={cn(
              'w-full max-w-md rounded-3xl border border-black/10 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-neutral-900',
              className,
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                  <Sparkles size={12} />
                  Share
                </p>
                <p
                  id={titleId}
                  className="mt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100"
                >
                  {cardTitle}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
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

            <div className="overflow-hidden rounded-2xl border border-black/10 bg-neutral-100 p-2 dark:border-white/10 dark:bg-neutral-950/60">
              {pending ? (
                <div className="flex h-[420px] items-center justify-center rounded-xl bg-white text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                  正在生成分享链接...
                </div>
              ) : posterDataUrl ? (
                <img
                  src={posterDataUrl}
                  alt="分享卡片预览"
                  className="h-auto w-full rounded-xl bg-white shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                />
              ) : (
                <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-xl bg-white px-6 text-center text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                  <QrCode size={28} />
                  暂无卡片预览
                </div>
              )}
            </div>

            <div className="mt-3 rounded-2xl border border-black/5 bg-neutral-50 p-3 dark:border-white/10 dark:bg-neutral-950/50">
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="分享二维码" className="h-full w-full object-cover" />
                  ) : (
                    <QrCode size={22} className="text-neutral-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    扫码或复制链接分享
                    {posterPending ? (
                      <span className="ml-2 text-xs font-medium text-neutral-400 dark:text-neutral-500">
                        海报生成中...
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {cardSubtitle}
                  </p>
                </div>
              </div>
              <p className="mt-3 break-all rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-200">
                {link || '链接生成中...'}
              </p>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {intentCopy.hint}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
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
  variant: TenantSharePosterVariant;
};

async function generateSharePoster(payload: SharePosterPayload): Promise<string> {
  return payload.variant === 'detail'
    ? generateDetailSharePoster(payload)
    : generateGenericSharePoster(payload);
}

async function generateGenericSharePoster(payload: SharePosterPayload): Promise<string> {
  const width = 1200;
  const height = 1680;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#111827');
  background.addColorStop(0.55, '#1f2937');
  background.addColorStop(1, '#0f172a');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawGlowCircle(ctx, width * 0.86, 200, 320, 'rgba(255,212,0,0.24)');
  drawGlowCircle(ctx, 160, height - 180, 240, 'rgba(250,204,21,0.18)');

  const cardX = 72;
  const cardY = 72;
  const cardWidth = width - 144;
  const cardHeight = height - 144;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.32)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 20;
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill();
  ctx.restore();

  const heroX = cardX + 42;
  const heroY = cardY + 42;
  const heroWidth = cardWidth - 84;
  const heroHeight = 560;

  if (payload.previewImageUrl) {
    try {
      const heroImage = await loadImage(payload.previewImageUrl);
      drawCoverImage(ctx, heroImage, heroX, heroY, heroWidth, heroHeight, 30);
    } catch {
      drawHeroFallback(ctx, heroX, heroY, heroWidth, heroHeight);
    }
  } else {
    drawHeroFallback(ctx, heroX, heroY, heroWidth, heroHeight);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('PUBLIC SHARE', heroX + 26, heroY + 52);

  drawMultilineText(ctx, payload.title, {
    x: heroX,
    y: heroY + heroHeight + 84,
    maxWidth: heroWidth,
    lineHeight: 66,
    maxLines: 2,
    font: '700 58px "Segoe UI", "PingFang SC", sans-serif',
    color: '#111827',
  });

  drawMultilineText(ctx, payload.subtitle, {
    x: heroX,
    y: heroY + heroHeight + 236,
    maxWidth: heroWidth,
    lineHeight: 46,
    maxLines: 3,
    font: '500 34px "Segoe UI", "PingFang SC", sans-serif',
    color: '#475569',
  });

  const qrPanelX = heroX;
  const qrPanelY = cardY + cardHeight - 450;
  const qrPanelWidth = heroWidth;
  const qrPanelHeight = 360;

  ctx.fillStyle = '#f8fafc';
  roundedRect(ctx, qrPanelX, qrPanelY, qrPanelWidth, qrPanelHeight, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,212,0,0.34)';
  ctx.lineWidth = 3;
  roundedRect(ctx, qrPanelX, qrPanelY, qrPanelWidth, qrPanelHeight, 28);
  ctx.stroke();

  const qrX = qrPanelX + 42;
  const qrY = qrPanelY + 34;
  const qrSize = 252;

  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 20);
  ctx.fill();

  const qrImage = await loadImage(payload.qrDataUrl);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#111827';
  ctx.font = '700 42px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('扫码查看公开页', qrX + qrSize + 40, qrY + 72);
  ctx.font = '500 30px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('二维码、海报和链接统一复用同一条分享链路', qrX + qrSize + 40, qrY + 130);
  ctx.fillText('支持直接转发，也支持弹窗内快速复制', qrX + qrSize + 40, qrY + 178);

  ctx.fillStyle = '#0f172a';
  ctx.font = '500 24px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText(
    'Generated by Eggturtle Breeding Library',
    qrPanelX + 42,
    qrPanelY + qrPanelHeight - 28,
  );

  return canvas.toDataURL('image/png');
}

async function generateDetailSharePoster(payload: SharePosterPayload): Promise<string> {
  const width = 1200;
  const height = 1680;
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

  const imageX = 64;
  const imageY = 64;
  const imageWidth = width - 128;
  const imageHeight = 930;

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
  ctx.font = '700 34px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('DETAIL SHARE', imageX + 34, imageY + 56);

  drawMultilineText(ctx, payload.title, {
    x: imageX + 34,
    y: imageY + imageHeight - 220,
    maxWidth: imageWidth - 68,
    lineHeight: 72,
    maxLines: 2,
    font: '700 62px "Segoe UI", "PingFang SC", sans-serif',
    color: '#ffffff',
  });

  drawMultilineText(ctx, payload.subtitle, {
    x: imageX + 34,
    y: imageY + imageHeight - 94,
    maxWidth: imageWidth - 68,
    lineHeight: 42,
    maxLines: 2,
    font: '500 30px "Segoe UI", "PingFang SC", sans-serif',
    color: 'rgba(255,255,255,0.86)',
  });

  const panelX = 64;
  const panelY = imageY + imageHeight + 34;
  const panelWidth = width - 128;
  const panelHeight = height - panelY - 64;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 36);
  ctx.fill();

  const qrSize = 248;
  const qrX = panelX + 42;
  const qrY = panelY + 44;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 20);
  ctx.fill();

  const qrImage = await loadImage(payload.qrDataUrl);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = '#111827';
  ctx.font = '700 40px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('扫码直达当前详情', qrX + qrSize + 40, qrY + 68);
  ctx.font = '500 30px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('主图作为分享主视觉，适合直接发客户', qrX + qrSize + 40, qrY + 126);
  ctx.fillText('二维码、海报和复制链接仍共用统一分享 token', qrX + qrSize + 40, qrY + 174);

  ctx.fillStyle = '#0f172a';
  ctx.font = '500 24px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('Generated by Eggturtle Breeding Library', panelX + 42, panelY + panelHeight - 30);

  return canvas.toDataURL('image/png');
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

    image.decoding = 'async';
    if (!src.startsWith('data:')) {
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
    image.src = src;
  });
}
