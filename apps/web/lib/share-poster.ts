import type { ResolvedSharePreviewProps } from '@/lib/share-preview';

export type SharePosterPayload = {
  qrDataUrl: string;
  footerLabel: string;
  badgeLabel?: string | null;
  preview: ResolvedSharePreviewProps;
};

export async function generateSharePoster(payload: SharePosterPayload): Promise<string> {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas unavailable');
  }

  const primaryColor = normalizeColor(payload.preview.primaryColor, '#FFD400');
  const secondaryColor = normalizeColor(payload.preview.secondaryColor, '#111827');
  const heroImageUrls = payload.preview.posterImageUrls.slice(0, 4);
  const heroImages = await loadAvailableImages(heroImageUrls);

  drawPosterBackground(ctx, width, height, primaryColor, secondaryColor);

  const cardX = 52;
  const cardY = 52;
  const cardWidth = width - cardX * 2;
  const cardHeight = height - cardY * 2;
  drawPosterCard(ctx, cardX, cardY, cardWidth, cardHeight);

  const contentX = cardX + 44;
  const contentWidth = cardWidth - 88;
  const heroY = cardY + 44;
  const heroHeight = 780;
  await drawPosterHero(ctx, {
    images: heroImages,
    x: contentX,
    y: heroY,
    width: contentWidth,
    height: heroHeight,
    primaryColor,
    secondaryColor,
    badgeLabel: payload.badgeLabel,
  });

  const titleY = heroY + heroHeight + 54;
  drawMultilineText(ctx, payload.preview.title, {
    x: contentX,
    y: titleY,
    maxWidth: contentWidth,
    lineHeight: 70,
    maxLines: 2,
    font: '800 58px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: '#111827',
  });

  const subtitleY = titleY + 156;
  drawMultilineText(ctx, payload.preview.subtitle, {
    x: contentX,
    y: subtitleY,
    maxWidth: contentWidth,
    lineHeight: 42,
    maxLines: 3,
    font: '500 30px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif',
    color: '#4b5563',
  });

  const metaY = subtitleY + 170;
  drawMetaChips(ctx, {
    x: contentX,
    y: metaY,
    primaryColor,
    secondaryColor,
    imageCount: heroImageUrls.length,
    wechatId: payload.preview.wechatId,
  });

  const qrSize = 214;
  const qrX = contentX;
  const qrY = cardY + cardHeight - qrSize - 176;
  const qrImage = await loadPosterImage(payload.qrDataUrl);
  drawQrSection(ctx, {
    x: qrX,
    y: qrY,
    size: qrSize,
    qrImage,
    primaryColor,
    secondaryColor,
  });

  const textX = qrX + qrSize + 48;
  ctx.fillStyle = '#111827';
  ctx.font = '800 38px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('扫码查看公开页', textX, qrY + 34);
  ctx.fillStyle = '#4b5563';
  ctx.font = '500 26px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText('海报、链接、二维码共用同一条分享链路', textX, qrY + 96);
  ctx.fillText('可保存图片，也可直接转发当前链接', textX, qrY + 138);

  ctx.fillStyle = applyAlpha(secondaryColor, 0.18);
  roundedRect(ctx, contentX, cardY + cardHeight - 88, contentWidth, 6, 3);
  ctx.fill();

  ctx.fillStyle = '#6b7280';
  ctx.font = '600 22px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText(payload.footerLabel, contentX, cardY + cardHeight - 36);

  return canvas.toDataURL('image/png');
}

export function normalizeShareFileName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return normalized || 'public-share';
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const [meta, data] = dataUrl.split(',');
  if (!meta || !data) {
    return null;
  }

  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/png';

  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

async function drawPosterHero(
  ctx: CanvasRenderingContext2D,
  input: {
    images: HTMLImageElement[];
    x: number;
    y: number;
    width: number;
    height: number;
    primaryColor: string;
    secondaryColor: string;
    badgeLabel?: string | null;
  },
) {
  const { images, x, y, width, height, primaryColor, secondaryColor, badgeLabel } = input;
  roundedRect(ctx, x, y, width, height, 38);
  ctx.save();
  ctx.clip();

  if (images.length === 0) {
    drawFallbackHero(ctx, x, y, width, height, primaryColor, secondaryColor);
  } else {
    drawImageCollage(ctx, images, x, y, width, height);
  }

  const overlay = ctx.createLinearGradient(x, y, x, y + height);
  overlay.addColorStop(0, 'rgba(17,24,39,0.1)');
  overlay.addColorStop(0.55, 'rgba(17,24,39,0)');
  overlay.addColorStop(1, 'rgba(17,24,39,0.3)');
  ctx.fillStyle = overlay;
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundedRect(ctx, x + 28, y + 28, 188, 52, 26);
  ctx.fill();
  ctx.fillStyle = '#111827';
  ctx.font = '700 22px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
  ctx.fillText(badgeLabel?.trim() || '公开分享海报', x + 52, y + 61);
  ctx.restore();

  if (images.length > 1) {
    const chipText = `${images.length} 张图`;
    const chipWidth = Math.max(124, 58 + ctx.measureText(chipText).width);
    const chipX = x + width - chipWidth - 28;
    const chipY = y + 28;

    ctx.save();
    ctx.fillStyle = applyAlpha(primaryColor, 0.92);
    roundedRect(ctx, chipX, chipY, chipWidth, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.font = '700 22px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
    ctx.fillText(chipText, chipX + 28, chipY + 33);
    ctx.restore();
  }
}

function drawPosterBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  primaryColor: string,
  secondaryColor: string,
) {
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, mixColor(primaryColor, '#fff5bf', 0.28));
  background.addColorStop(0.48, '#fffaf0');
  background.addColorStop(1, mixColor(secondaryColor, '#111827', 0.1));
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  drawGlowCircle(ctx, width * 0.84, 220, 360, applyAlpha(primaryColor, 0.24));
  drawGlowCircle(ctx, 160, height - 260, 320, applyAlpha(secondaryColor, 0.1));
}

function drawPosterCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.18)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 26;
  roundedRect(ctx, x, y, width, height, 52);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill();
  ctx.restore();
}

function drawFallbackHero(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  primaryColor: string,
  secondaryColor: string,
) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, mixColor(primaryColor, '#fff4b1', 0.18));
  gradient.addColorStop(1, mixColor(secondaryColor, '#111827', 0.12));
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.strokeStyle = applyAlpha('#ffffff', 0.5);
  ctx.lineWidth = 2;
  for (let index = 0; index < 7; index += 1) {
    const offset = 24 + index * 72;
    ctx.beginPath();
    ctx.moveTo(x + offset, y + 20);
    ctx.lineTo(x + offset + 260, y + height - 20);
    ctx.stroke();
  }
}

function drawImageCollage(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const gap = 14;

  if (images.length === 1) {
    drawCoverImage(ctx, images[0]!, x, y, width, height, 0);
    return;
  }

  if (images.length === 2) {
    const leftWidth = Math.floor((width - gap) * 0.58);
    drawCoverImage(ctx, images[0]!, x, y, leftWidth, height, 0);
    drawCoverImage(ctx, images[1]!, x + leftWidth + gap, y, width - leftWidth - gap, height, 0);
    return;
  }

  if (images.length === 3) {
    const leftWidth = Math.floor((width - gap) * 0.57);
    const rightWidth = width - leftWidth - gap;
    const itemHeight = (height - gap) / 2;
    drawCoverImage(ctx, images[0]!, x, y, leftWidth, height, 0);
    drawCoverImage(ctx, images[1]!, x + leftWidth + gap, y, rightWidth, itemHeight, 0);
    drawCoverImage(
      ctx,
      images[2]!,
      x + leftWidth + gap,
      y + itemHeight + gap,
      rightWidth,
      itemHeight,
      0,
    );
    return;
  }

  const itemWidth = (width - gap) / 2;
  const itemHeight = (height - gap) / 2;
  const positions = [
    [x, y],
    [x + itemWidth + gap, y],
    [x, y + itemHeight + gap],
    [x + itemWidth + gap, y + itemHeight + gap],
  ] as const;

  images.slice(0, 4).forEach((image, index) => {
    const [itemX, itemY] = positions[index]!;
    drawCoverImage(ctx, image, itemX, itemY, itemWidth, itemHeight, 0);
  });
}

function drawMetaChips(
  ctx: CanvasRenderingContext2D,
  input: {
    x: number;
    y: number;
    primaryColor: string;
    secondaryColor: string;
    imageCount: number;
    wechatId?: string | null;
  },
) {
  const chips = [
    input.imageCount > 1 ? `多图海报 · ${input.imageCount} 张` : '单图海报',
    '统一分享链路',
    input.wechatId ? `微信：${input.wechatId}` : null,
  ].filter((item): item is string => Boolean(item));

  let currentX = input.x;
  chips.forEach((chip, index) => {
    const width = Math.max(138, 34 + ctx.measureText(chip).width);
    ctx.save();
    ctx.fillStyle = index === 0 ? applyAlpha(input.primaryColor, 0.18) : applyAlpha(input.secondaryColor, 0.08);
    roundedRect(ctx, currentX, input.y, width, 42, 21);
    ctx.fill();
    ctx.fillStyle = '#374151';
    ctx.font = '600 20px "Avenir Next", "PingFang SC", "Segoe UI", sans-serif';
    ctx.fillText(chip, currentX + 18, input.y + 27);
    ctx.restore();
    currentX += width + 12;
  });
}

function drawQrSection(
  ctx: CanvasRenderingContext2D,
  input: {
    x: number;
    y: number;
    size: number;
    qrImage: HTMLImageElement;
    primaryColor: string;
    secondaryColor: string;
  },
) {
  const { x, y, size, qrImage, primaryColor, secondaryColor } = input;
  ctx.save();
  const background = ctx.createLinearGradient(x - 16, y - 16, x + size + 16, y + size + 16);
  background.addColorStop(0, applyAlpha(primaryColor, 0.18));
  background.addColorStop(1, applyAlpha(secondaryColor, 0.08));
  ctx.fillStyle = background;
  roundedRect(ctx, x - 16, y - 16, size + 32, size + 32, 32);
  ctx.fill();
  ctx.strokeStyle = applyAlpha(primaryColor, 0.35);
  ctx.lineWidth = 3;
  roundedRect(ctx, x - 16, y - 16, size + 32, size + 32, 32);
  ctx.stroke();
  ctx.restore();

  ctx.drawImage(qrImage, x, y, size, size);
}

function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
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

function drawMultilineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: TextBlockOptions,
) {
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

async function loadAvailableImages(urls: string[]): Promise<HTMLImageElement[]> {
  const results = await Promise.allSettled(urls.map((url) => loadPosterImage(url)));
  return results
    .filter((result): result is PromiseFulfilledResult<HTMLImageElement> => result.status === 'fulfilled')
    .map((result) => result.value);
}

async function loadPosterImage(src: string): Promise<HTMLImageElement> {
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
    const suffix = `${parsed.search}${parsed.hash}`;
    const shouldUseProxy =
      /^\/products\/[^/]+\/images\/[^/]+\/content$/.test(normalizedPath) ||
      /^\/products\/[^/]+\/certificates\/[^/]+\/content$/.test(normalizedPath) ||
      /^\/products\/[^/]+\/couple-photos\/[^/]+\/content$/.test(normalizedPath);
    const shouldForceSameOrigin =
      normalizedPath.startsWith('/images/') ||
      normalizedPath === '/tenant-share-presentation/assets' ||
      (/^\/shares\/[^/]+\/public\/assets$/.test(normalizedPath) && Boolean(suffix));

    if (shouldUseProxy && !normalizedPath.startsWith('/api/proxy/')) {
      return `/api/proxy${normalizedPath}${suffix}`;
    }

    if (shouldForceSameOrigin) {
      return `${normalizedPath}${suffix}`;
    }

    if (!/^https?:\/\//i.test(src)) {
      return `${normalizedPath}${suffix}`;
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

function normalizeColor(color: string | null | undefined, fallback: string): string {
  const value = color?.trim() || '';
  if (/^#([0-9a-fA-F]{6})$/.test(value)) {
    return value;
  }
  if (/^#([0-9a-fA-F]{3})$/.test(value)) {
    const red = value[1];
    const green = value[2];
    const blue = value[3];
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }
  return fallback;
}

function mixColor(colorA: string, colorB: string, ratio: number): string {
  const safeRatio = Math.min(1, Math.max(0, ratio));
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  return `rgb(${Math.round(r1 * (1 - safeRatio) + r2 * safeRatio)}, ${Math.round(g1 * (1 - safeRatio) + g2 * safeRatio)}, ${Math.round(b1 * (1 - safeRatio) + b2 * safeRatio)})`;
}

function applyAlpha(color: string, alpha: number): string {
  const [red, green, blue] = hexToRgb(color);
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

function hexToRgb(color: string): [number, number, number] {
  const normalized = normalizeColor(color, '#000000').replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
