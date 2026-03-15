import type { TenantShareAvatarPreset } from '@eggturtle/shared';

import { resolveShareAvatarInitial, resolveShareAvatarTheme } from '@/lib/share-avatar';

export type ShareComboPosterPayload = {
  title: string;
  subtitle: string;
  qrDataUrl: string;
  primaryColor?: string;
  secondaryColor?: string;
  heroImageUrl?: string | null;
  footerLabel?: string | null;
  displayName?: string | null;
  accountLabel?: string | null;
  avatarUrl?: string | null;
  avatarPreset?: TenantShareAvatarPreset | null;
  contactLabel?: string | null;
  stats?: {
    breederCount?: number;
    maleCount?: number;
    femaleCount?: number;
    seriesCount?: number;
    needMatingCount?: number;
    eggsThisYear?: number;
  } | null;
};

export async function generateShareComboPoster(payload: ShareComboPosterPayload): Promise<string> {
  const width = 1080;
  const height = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }

  const primaryColor = normalizeColor(payload.primaryColor, '#FFD400');
  const secondaryColor = normalizeColor(payload.secondaryColor, '#111827');
  const displayName = payload.displayName?.trim() || payload.title.trim() || '公开分享主页';
  const accountLabel = payload.accountLabel?.trim() || '@public-share';
  const posterTitle = formatPosterTitle(displayName);
  const posterSubtitle = formatPosterSubtitle(payload.subtitle);
  const avatarSeed = `${displayName}|${accountLabel}`;
  const avatarTheme = resolveShareAvatarTheme(payload.avatarPreset, avatarSeed);
  const avatarInitial = resolveShareAvatarInitial(displayName || accountLabel, '龟');
  const statsText = formatStatsText(payload.stats);
  const imageUrls = [payload.heroImageUrl?.trim() ?? ''].filter(Boolean);
  const [images, qrImage, avatarImage] = await Promise.all([
    loadImages(imageUrls),
    loadImage(payload.qrDataUrl).catch(() => null),
    payload.avatarUrl?.trim() ? loadImage(payload.avatarUrl.trim()).catch(() => null) : null,
  ]);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  roundedRect(ctx, 0, 0, width, height, 42);
  ctx.clip();

  if (images.length === 0) {
    drawHeroFallback(ctx, 0, 0, width, height, primaryColor, secondaryColor);
  } else {
    drawImageCollage(ctx, images, 0, 0, width, height);
  }

  const atmosphereOverlay = ctx.createLinearGradient(0, 0, 0, height);
  atmosphereOverlay.addColorStop(0, 'rgba(255,255,255,0)');
  atmosphereOverlay.addColorStop(0.52, 'rgba(255,255,255,0)');
  atmosphereOverlay.addColorStop(0.65, 'rgba(255,255,255,0.18)');
  atmosphereOverlay.addColorStop(0.78, 'rgba(255,255,255,0.55)');
  atmosphereOverlay.addColorStop(0.88, 'rgba(255,255,255,0.88)');
  atmosphereOverlay.addColorStop(1, 'rgba(255,255,255,0.98)');
  ctx.fillStyle = atmosphereOverlay;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Add soft text readability backdrop
  const textBackdropGradient = ctx.createLinearGradient(0, 640, 0, 1080);
  textBackdropGradient.addColorStop(0, 'rgba(255,255,255,0)');
  textBackdropGradient.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  textBackdropGradient.addColorStop(0.45, 'rgba(255,255,255,0.92)');
  textBackdropGradient.addColorStop(1, 'rgba(255,255,255,0.97)');
  ctx.fillStyle = textBackdropGradient;
  ctx.fillRect(0, 640, width, 440);

  const titleX = 48;
  const titleY = 680;

  // Stats row if available
  if (statsText) {
    const statsBgGradient = ctx.createLinearGradient(0, titleY - 8, 0, titleY + 40);
    statsBgGradient.addColorStop(0, 'rgba(255,255,255,0.88)');
    statsBgGradient.addColorStop(1, 'rgba(255,255,255,0.96)');
    ctx.fillStyle = statsBgGradient;
    roundedRect(ctx, titleX - 4, titleY - 10, width - 88, 48, 20);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.font = '600 20px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(statsText, titleX + 12, titleY + 2);
  }

  // Title
  const adjustedTitleY = statsText ? titleY + 56 : titleY;
  drawMultilineText(ctx, posterTitle, {
    x: titleX,
    y: adjustedTitleY,
    maxWidth: width - 96,
    lineHeight: 48,
    maxLines: 1,
    font: '700 40px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: '#111827',
  });

  // Account label
  ctx.fillStyle = '#5f6b7a';
  ctx.font = '600 22px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(accountLabel, titleX, adjustedTitleY + 56);

  // Subtitle
  drawMultilineText(ctx, posterSubtitle, {
    x: titleX,
    y: adjustedTitleY + 96,
    maxWidth: width - 96,
    lineHeight: 34,
    maxLines: 2,
    font: '500 24px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: '#566375',
  });

  // Info strip
  drawInfoStrip(ctx, {
    x: 44,
    y: statsText ? 910 : 890,
    width: width - 88,
    height: 152,
    qrImage,
    primaryColor,
    title: '扫码查看',
    subtitle: '进入完整公开图鉴',
    footerLabel: payload.footerLabel,
    avatarInitial,
    avatarImage,
    avatarTheme,
  });

  return canvas.toDataURL('image/png');
}

type AvatarInput = {
  x: number;
  y: number;
  size: number;
  initial: string;
  avatarImage?: HTMLImageElement | null;
  avatarTheme: ReturnType<typeof resolveShareAvatarTheme>;
};

type InfoStripInput = {
  x: number;
  y: number;
  width: number;
  height: number;
  qrImage: HTMLImageElement | null;
  primaryColor: string;
  title: string;
  subtitle: string;
  footerLabel?: string | null;
  avatarInitial: string;
  avatarImage: HTMLImageElement | null;
  avatarTheme: ReturnType<typeof resolveShareAvatarTheme>;
};

type TextBlockOptions = {
  x: number;
  y: number;
  maxWidth: number;
  lineHeight: number;
  maxLines: number;
  font: string;
  color: string;
};

async function drawAvatar(ctx: CanvasRenderingContext2D, input: AvatarInput) {
  const { x, y, size, initial, avatarImage, avatarTheme } = input;
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, avatarTheme.backgroundFrom);
  gradient.addColorStop(1, avatarTheme.backgroundTo);

  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, x - 4, y - 4, size + 8, size + 8, (size + 8) / 2);
  ctx.fill();

  ctx.fillStyle = avatarTheme.ring;
  roundedRect(ctx, x - 1, y - 1, size + 2, size + 2, (size + 2) / 2);
  ctx.fill();

  roundedRect(ctx, x, y, size, size, size / 2);
  if (avatarImage) {
    ctx.save();
    ctx.clip();
    drawCoverImage(ctx, avatarImage, x, y, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.fillStyle = avatarTheme.foreground;
    ctx.font = '800 34px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial.slice(0, 1), x + size / 2, y + size / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

function drawInfoStrip(ctx: CanvasRenderingContext2D, input: InfoStripInput) {
  const {
    x,
    y,
    width,
    height,
    qrImage,
    primaryColor,
    title,
    subtitle,
    footerLabel,
    avatarInitial,
    avatarImage,
    avatarTheme,
  } = input;

  const stripGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  stripGradient.addColorStop(0, 'rgba(255,255,255,0.96)');
  stripGradient.addColorStop(1, 'rgba(252,248,240,0.98)');
  ctx.fillStyle = stripGradient;
  roundedRect(ctx, x, y, width, height, 28);
  ctx.fill();

  // Subtle shadow for better separation
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 4;
  roundedRect(ctx, x, y, width, height, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.01)';
  ctx.fill();
  ctx.restore();

  const qrSize = 104;
  const qrX = x + 22;
  const qrY = y + 24;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 20);
  ctx.fill();
  if (qrImage) {
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  } else {
    ctx.fillStyle = '#eef2f7';
    roundedRect(ctx, qrX, qrY, qrSize, qrSize, 16);
    ctx.fill();
  }

  const textX = qrX + qrSize + 30;
  ctx.fillStyle = '#111827';
  ctx.font = '700 28px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(title, textX, y + 30);
  ctx.fillStyle = '#5f6b7a';
  ctx.font = '500 22px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText(subtitle, textX, y + 72);
  if (footerLabel?.trim()) {
    ctx.fillStyle = applyAlpha(primaryColor, 0.82);
    ctx.font = '600 18px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
    ctx.fillText(footerLabel.trim(), textX, y + 108);
  }

  drawAvatar(ctx, {
    x: x + width - 22 - 84,
    y: y + (height - 84) / 2,
    size: 84,
    initial: avatarInitial,
    avatarImage,
    avatarTheme,
  });

  ctx.textBaseline = 'alphabetic';
}

function formatPosterTitle(input: string) {
  const normalized = input.trim();
  if (!normalized) {
    return '公开图鉴';
  }

  if (normalized.includes('图鉴')) {
    return normalized.replace(/\s*·\s*公开图鉴/g, ' 图鉴');
  }

  return `${normalized} 图鉴`;
}

function formatPosterSubtitle(input: string) {
  const normalized = input.trim();
  if (!normalized) {
    return '在库个体公开展示';
  }

  return normalized
    .replace(/产品展示/g, '个体展示')
    .replace(/在库个体展示/g, '在库个体公开展示')
    .replace(/在库产品展示/g, '在库个体公开展示');
}

function drawImageCollage(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (images.length <= 1) {
    drawCoverImage(ctx, images[0]!, x, y, width, height);
    return;
  }

  if (images.length === 2) {
    const gap = 8;
    const paneWidth = (width - gap) / 2;
    drawCoverImage(ctx, images[0]!, x, y, paneWidth, height);
    drawCoverImage(ctx, images[1]!, x + paneWidth + gap, y, paneWidth, height);
    return;
  }

  if (images.length === 3) {
    const gap = 8;
    const leftWidth = width * 0.58;
    const rightWidth = width - leftWidth - gap;
    const rightHeight = (height - gap) / 2;
    drawCoverImage(ctx, images[0]!, x, y, leftWidth, height);
    drawCoverImage(ctx, images[1]!, x + leftWidth + gap, y, rightWidth, rightHeight);
    drawCoverImage(
      ctx,
      images[2]!,
      x + leftWidth + gap,
      y + rightHeight + gap,
      rightWidth,
      rightHeight,
    );
    return;
  }

  const gap = 8;
  const paneWidth = (width - gap) / 2;
  const paneHeight = (height - gap) / 2;
  drawCoverImage(ctx, images[0]!, x, y, paneWidth, paneHeight);
  drawCoverImage(ctx, images[1]!, x + paneWidth + gap, y, paneWidth, paneHeight);
  drawCoverImage(ctx, images[2]!, x, y + paneHeight + gap, paneWidth, paneHeight);
  drawCoverImage(ctx, images[3]!, x + paneWidth + gap, y + paneHeight + gap, paneWidth, paneHeight);
}

function drawHeroFallback(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  primaryColor: string,
  secondaryColor: string,
) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, mixColor(primaryColor, '#fff8dc', 0.18));
  gradient.addColorStop(1, mixColor(secondaryColor, '#111827', 0.14));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = 'rgba(255,255,255,0.68)';
  ctx.lineWidth = 2;
  for (let index = 0; index < 7; index += 1) {
    const offset = 34 + index * 56;
    ctx.beginPath();
    ctx.moveTo(x + offset, y + 20);
    ctx.lineTo(x + offset + 250, y + height - 20);
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

  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

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

  lines.slice(0, options.maxLines).forEach((line, index) => {
    ctx.fillText(line, options.x, options.y + options.lineHeight * index);
  });

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

function applyAlpha(color: string, alpha: number): string {
  const [red, green, blue] = hexToRgb(color);
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(1, Math.max(0, alpha))})`;
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

function hexToRgb(color: string): [number, number, number] {
  const normalized = normalizeColor(color, '#000000').replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return [red, green, blue];
}

async function loadImages(urls: string[]) {
  const results = await Promise.allSettled(urls.map((item) => loadImage(item)));
  return results.flatMap((item) => (item.status === 'fulfilled' ? [item.value] : []));
}

function formatStatsText(stats: ShareComboPosterPayload['stats']): string | null {
  if (!stats) {
    return null;
  }

  const parts: string[] = [];

  // Total breeders with male/female breakdown
  if (stats.breederCount && stats.breederCount > 0) {
    if (stats.maleCount != null && stats.femaleCount != null) {
      parts.push(`${stats.breederCount}只种龟（${stats.maleCount}公${stats.femaleCount}母）`);
    } else {
      parts.push(`${stats.breederCount}只种龟`);
    }
  } else if (stats.maleCount != null && stats.femaleCount != null) {
    parts.push(`${stats.maleCount}公${stats.femaleCount}母`);
  }

  // Series count
  if (stats.seriesCount && stats.seriesCount > 0) {
    parts.push(`${stats.seriesCount}个系列`);
  }

  // Need mating count
  if (stats.needMatingCount && stats.needMatingCount > 0) {
    parts.push(`${stats.needMatingCount}只待配`);
  }

  // Eggs this year
  if (stats.eggsThisYear != null && stats.eggsThisYear > 0) {
    parts.push(`今年已产${stats.eggsThisYear}蛋`);
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join(' · ');
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
