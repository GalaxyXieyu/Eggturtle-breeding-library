/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Home, QrCode, Share2, Sparkles, X } from 'lucide-react';
import QRCode from 'qrcode';

import {
  FloatingActionButton,
  FloatingActionDock,
  floatingActionButtonClass,
  modalCloseButtonClass
} from '@/components/ui/floating-actions';
import { cn } from '@/lib/utils';

type PublicFloatingActionsProps = {
  permalink?: string;
  useCurrentUrl?: boolean;
  homeHref?: string;
  showHomeButton?: boolean;
  className?: string;
  /** 与默认按钮同一容器内上下排列的额外按钮（如筛选），统一在右侧 */
  children?: ReactNode;
  /** 用户在分享配置里上传的联系二维码 */
  tenantQrImageUrl?: string | null;
  tenantWechatId?: string | null;
  shareCardTitle?: string;
  shareCardSubtitle?: string;
  shareCardPrimaryColor?: string;
  shareCardSecondaryColor?: string;
  shareCardHeroImageUrl?: string | null;
};

const DEFAULT_SHARE_TITLE = '选育溯源档案 · 公开图鉴';
const DEFAULT_SHARE_SUBTITLE = '扫码查看完整公开图鉴与更新动态';

export default function PublicFloatingActions({
  permalink: permalinkProp,
  useCurrentUrl = false,
  homeHref = '/app',
  showHomeButton = true,
  className,
  children,
  tenantQrImageUrl,
  tenantWechatId,
  shareCardTitle,
  shareCardSubtitle,
  shareCardPrimaryColor,
  shareCardSecondaryColor,
  shareCardHeroImageUrl
}: PublicFloatingActionsProps) {
  const [tenantQrOpen, setTenantQrOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [linkQrDataUrl, setLinkQrDataUrl] = useState<string | null>(null);
  const [shareCardDataUrl, setShareCardDataUrl] = useState<string | null>(null);
  const [shareCardLoading, setShareCardLoading] = useState(false);
  const [shareCardError, setShareCardError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    if (!useCurrentUrl) return;
    setCurrentUrl(typeof window !== 'undefined' ? window.location.href : '');
  }, [useCurrentUrl]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const permalink = useCurrentUrl ? currentUrl : (permalinkProp ?? '');
  const cardTitle = shareCardTitle?.trim() || DEFAULT_SHARE_TITLE;
  const cardSubtitle = shareCardSubtitle?.trim() || DEFAULT_SHARE_SUBTITLE;

  // 本地生成链接二维码，避免把公开链接发给第三方二维码服务。
  useEffect(() => {
    if (!permalink) {
      setLinkQrDataUrl(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const dataUrl = await QRCode.toDataURL(permalink, {
          width: 360,
          margin: 1,
          errorCorrectionLevel: 'H'
        });
        if (!cancelled) {
          setLinkQrDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setLinkQrDataUrl(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [permalink]);

  useEffect(() => {
    if (!shareOpen || !permalink || !linkQrDataUrl) {
      return;
    }

    let cancelled = false;
    setShareCardLoading(true);
    setShareCardError(null);

    void (async () => {
      try {
        const dataUrl = await generateSharePoster({
          qrDataUrl: linkQrDataUrl,
          title: cardTitle,
          subtitle: cardSubtitle,
          primaryColor: shareCardPrimaryColor,
          secondaryColor: shareCardSecondaryColor,
          heroImageUrl: shareCardHeroImageUrl,
          wechatId: tenantWechatId
        });

        if (!cancelled) {
          setShareCardDataUrl(dataUrl);
          setShareCardError(null);
        }
      } catch {
        if (!cancelled) {
          setShareCardDataUrl(null);
          setShareCardError('卡片生成失败，请稍后重试。');
        }
      } finally {
        if (!cancelled) {
          setShareCardLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    shareOpen,
    permalink,
    linkQrDataUrl,
    cardTitle,
    cardSubtitle,
    shareCardPrimaryColor,
    shareCardSecondaryColor,
    shareCardHeroImageUrl,
    tenantWechatId
  ]);

  async function handleShareAction() {
    if (!permalink) {
      setError('分享链接尚未就绪，请稍后再试。');
      return;
    }

    const shareText = `${cardTitle}\n${cardSubtitle}`;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const blob = shareCardDataUrl ? dataUrlToBlob(shareCardDataUrl) : null;

        if (blob) {
          const file = new File([blob], `${normalizeFileName(cardTitle)}.png`, { type: 'image/png' });
          if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: cardTitle,
              text: shareText,
              url: permalink,
              files: [file]
            });
            return;
          }
        }

        await navigator.share({
          title: cardTitle,
          text: shareText,
          url: permalink
        });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(permalink);
      setNotice('已复制分享链接，可直接粘贴发送。');
    } catch {
      setError('无法调用系统分享，请手动复制链接。');
    }
  }

  function handleDownloadShareCard() {
    if (!shareCardDataUrl) {
      setError('分享卡片仍在生成中，请稍后再试。');
      return;
    }

    const link = document.createElement('a');
    link.download = `${normalizeFileName(cardTitle)}-share-card.png`;
    link.href = shareCardDataUrl;
    link.click();
    setNotice('高清分享卡片已开始下载。');
  }

  return (
    <>
      <FloatingActionDock
        className={cn(
          '!z-[55] !bottom-[calc(56px+max(24px,env(safe-area-inset-bottom))+12px)] lg:!bottom-[calc(56px+max(24px,env(safe-area-inset-bottom))+12px)]',
          className
        )}
      >
        {children}

        <FloatingActionButton
          aria-label="生成分享卡片"
          title="生成分享卡片"
          onClick={() => {
            setShareOpen(true);
            setError(null);
          }}
        >
          <Share2 size={20} />
        </FloatingActionButton>

        <FloatingActionButton
          aria-label="用户联系二维码"
          title="用户联系二维码"
          onClick={() => setTenantQrOpen(true)}
        >
          <QrCode size={20} />
        </FloatingActionButton>

        {showHomeButton ? (
          <a
            href={homeHref}
            aria-label="进入后台"
            title="进入后台"
            className={floatingActionButtonClass}
          >
            <Home size={18} />
          </a>
        ) : null}
      </FloatingActionDock>

      {tenantQrOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="用户联系二维码"
          onClick={() => setTenantQrOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-black/10 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-neutral-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">用户联系二维码</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">扫码可直接联系当前用户</p>
              </div>
              <button
                type="button"
                aria-label="关闭二维码"
                className={modalCloseButtonClass}
                onClick={() => setTenantQrOpen(false)}
              >
                <X size={17} strokeWidth={2.6} />
              </button>
            </div>

            {tenantQrImageUrl ? (
              <img
                src={tenantQrImageUrl}
                alt="用户联系二维码"
                className="mx-auto h-64 w-64 rounded-2xl border border-black/5 bg-white object-cover p-1"
              />
            ) : (
              <div className="mx-auto flex h-64 w-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-center text-xs text-neutral-500 dark:border-white/20 dark:bg-neutral-950/50 dark:text-neutral-400">
                <QrCode size={20} />
                当前用户暂未上传联系二维码
              </div>
            )}

            {tenantWechatId ? (
              <p className="mt-3 text-center text-sm text-neutral-700 dark:text-neutral-300">
                微信号：<span className="font-mono font-semibold">{tenantWechatId}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {shareOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="分享卡片"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-neutral-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                  <Sparkles size={12} />
                  Share Card
                </p>
                <p className="mt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">高质量二维码分享卡片</p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">可下载 PNG，或直接调用系统分享。</p>
              </div>
              <button
                type="button"
                aria-label="关闭分享卡片"
                className={modalCloseButtonClass}
                onClick={() => setShareOpen(false)}
              >
                <X size={17} strokeWidth={2.6} />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-black/10 bg-neutral-100 p-2 dark:border-white/10 dark:bg-neutral-950/60">
              {shareCardLoading ? (
                <div className="flex h-[420px] items-center justify-center rounded-xl bg-white text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                  正在生成高清卡片...
                </div>
              ) : shareCardDataUrl ? (
                <img
                  src={shareCardDataUrl}
                  alt="分享卡片预览"
                  className="h-auto w-full rounded-xl bg-white shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                />
              ) : (
                <div className="flex h-[420px] items-center justify-center rounded-xl bg-white px-6 text-center text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                  {shareCardError || '分享卡片暂不可用'}
                </div>
              )}
            </div>

            <p className="mt-3 line-clamp-2 rounded-xl border border-black/5 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-white/10 dark:bg-neutral-950/50 dark:text-neutral-300">
              {permalink || '链接生成中...'}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadShareCard}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-black/10 bg-white px-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100"
              >
                下载 PNG
              </button>
              <button
                type="button"
                onClick={() => void handleShareAction()}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-neutral-900 px-3 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-[#FFD400] dark:text-neutral-900 dark:hover:bg-[#f1ca00]"
              >
                立即分享
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="fixed left-4 right-4 z-[70] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/90 dark:text-red-200 sm:left-auto sm:right-6 sm:max-w-xs"
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
          className="fixed left-4 right-4 z-[70] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200 sm:left-auto sm:right-6 sm:max-w-xs"
          role="status"
        >
          {notice}
        </div>
      ) : null}
    </>
  );
}

type SharePosterPayload = {
  qrDataUrl: string;
  title: string;
  subtitle: string;
  primaryColor?: string;
  secondaryColor?: string;
  heroImageUrl?: string | null;
  wechatId?: string | null;
};

async function generateSharePoster(payload: SharePosterPayload): Promise<string> {
  const width = 1200;
  const height = 1800;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas unavailable');
  }

  const primaryColor = normalizeColor(payload.primaryColor, '#FFD400');
  const secondaryColor = normalizeColor(payload.secondaryColor, '#1f2937');

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, secondaryColor);
  background.addColorStop(0.55, mixColor(secondaryColor, '#111827', 0.45));
  background.addColorStop(1, '#0f172a');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawGlowCircle(ctx, width * 0.88, 200, 340, applyAlpha(primaryColor, 0.3));
  drawGlowCircle(ctx, 140, height - 220, 260, applyAlpha(primaryColor, 0.2));

  const cardX = 72;
  const cardY = 78;
  const cardWidth = width - cardX * 2;
  const cardHeight = height - 156;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.32)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 20;
  roundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fill();
  ctx.restore();

  const heroX = cardX + 42;
  const heroY = cardY + 42;
  const heroWidth = cardWidth - 84;
  const heroHeight = 560;

  if (payload.heroImageUrl) {
    try {
      const heroImage = await loadImage(payload.heroImageUrl);
      drawCoverImage(ctx, heroImage, heroX, heroY, heroWidth, heroHeight, 30);
      const heroOverlay = ctx.createLinearGradient(0, heroY + heroHeight * 0.45, 0, heroY + heroHeight);
      heroOverlay.addColorStop(0, 'rgba(15,23,42,0.04)');
      heroOverlay.addColorStop(1, 'rgba(15,23,42,0.38)');
      ctx.save();
      roundedRect(ctx, heroX, heroY, heroWidth, heroHeight, 30);
      ctx.clip();
      ctx.fillStyle = heroOverlay;
      ctx.fillRect(heroX, heroY, heroWidth, heroHeight);
      ctx.restore();
    } catch {
      drawHeroFallback(ctx, heroX, heroY, heroWidth, heroHeight, primaryColor, secondaryColor);
    }
  } else {
    drawHeroFallback(ctx, heroX, heroY, heroWidth, heroHeight, primaryColor, secondaryColor);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('PUBLIC SHARE', heroX + 26, heroY + 52);

  const titleY = heroY + heroHeight + 90;
  drawMultilineText(ctx, payload.title, {
    x: heroX,
    y: titleY,
    maxWidth: heroWidth,
    lineHeight: 66,
    maxLines: 2,
    font: '700 58px "Segoe UI", "PingFang SC", sans-serif',
    color: '#111827'
  });

  const subtitleY = titleY + 152;
  drawMultilineText(ctx, payload.subtitle, {
    x: heroX,
    y: subtitleY,
    maxWidth: heroWidth,
    lineHeight: 46,
    maxLines: 3,
    font: '500 34px "Segoe UI", "PingFang SC", sans-serif',
    color: '#475569'
  });

  const qrPanelWidth = heroWidth;
  const qrPanelHeight = 470;
  const qrPanelX = heroX;
  const qrPanelY = cardY + cardHeight - qrPanelHeight - 44;

  const qrPanelGradient = ctx.createLinearGradient(qrPanelX, qrPanelY, qrPanelX + qrPanelWidth, qrPanelY + qrPanelHeight);
  qrPanelGradient.addColorStop(0, '#ffffff');
  qrPanelGradient.addColorStop(1, '#f8fafc');
  ctx.fillStyle = qrPanelGradient;
  roundedRect(ctx, qrPanelX, qrPanelY, qrPanelWidth, qrPanelHeight, 28);
  ctx.fill();

  ctx.strokeStyle = applyAlpha(primaryColor, 0.38);
  ctx.lineWidth = 3;
  roundedRect(ctx, qrPanelX, qrPanelY, qrPanelWidth, qrPanelHeight, 28);
  ctx.stroke();

  const qrSize = 292;
  const qrX = qrPanelX + 42;
  const qrY = qrPanelY + (qrPanelHeight - qrSize) / 2;

  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 20);
  ctx.fill();

  const qrImage = await loadImage(payload.qrDataUrl);
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  const textX = qrX + qrSize + 44;
  ctx.fillStyle = '#111827';
  ctx.font = '700 46px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('扫码查看图鉴', textX, qrY + 84);
  ctx.font = '500 30px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('高质量公开分享页，支持持续更新', textX, qrY + 142);
  ctx.fillText('可直接转发给客户 / 朋友 / 龟友', textX, qrY + 190);

  if (payload.wechatId) {
    ctx.font = '600 28px "Segoe UI", "PingFang SC", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`微信：${payload.wechatId}`, textX, qrY + 248);
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = '500 24px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText('Generated by Eggturtle Breeding Library', qrPanelX + 42, qrPanelY + qrPanelHeight - 30);

  return canvas.toDataURL('image/png');
}

function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  color: string
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
  primaryColor: string,
  secondaryColor: string
) {
  const heroGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  heroGradient.addColorStop(0, mixColor(primaryColor, '#fffbe8', 0.22));
  heroGradient.addColorStop(1, mixColor(secondaryColor, '#111827', 0.2));

  ctx.fillStyle = heroGradient;
  roundedRect(ctx, x, y, width, height, 30);
  ctx.fill();

  ctx.strokeStyle = applyAlpha('#ffffff', 0.65);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const offset = 36 + i * 44;
    ctx.beginPath();
    ctx.moveTo(x + offset, y + 20);
    ctx.lineTo(x + offset + 260, y + height - 20);
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
  radius: number
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

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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

  if (lines.length > options.maxLines) {
    lines.length = options.maxLines;
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

function normalizeColor(color: string | undefined, fallback: string): string {
  const value = color?.trim() || '';
  if (/^#([0-9a-fA-F]{6})$/.test(value)) {
    return value;
  }
  if (/^#([0-9a-fA-F]{3})$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function mixColor(colorA: string, colorB: string, ratio: number): string {
  const safeRatio = Math.min(1, Math.max(0, ratio));
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  const red = Math.round(r1 * (1 - safeRatio) + r2 * safeRatio);
  const green = Math.round(g1 * (1 - safeRatio) + g2 * safeRatio);
  const blue = Math.round(b1 * (1 - safeRatio) + b2 * safeRatio);
  return `rgb(${red}, ${green}, ${blue})`;
}

function applyAlpha(color: string, alpha: number): string {
  const [red, green, blue] = hexToRgb(color);
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

function hexToRgb(color: string): [number, number, number] {
  const normalized = normalizeColor(color, '#000000').replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return [red, green, blue];
}

function normalizeFileName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return normalized || 'public-share';
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const [meta, data] = dataUrl.split(',');
  if (!meta || !data) {
    return null;
  }

  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/png';

  try {
    const binary = atob(data);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    if (!src.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load error'));
    image.src = src;
  });
}
