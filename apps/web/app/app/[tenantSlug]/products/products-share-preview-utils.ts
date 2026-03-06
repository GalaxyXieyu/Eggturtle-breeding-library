import type { TenantSharePresentation } from '@eggturtle/shared';

import {
  DEFAULT_SHARE_PREVIEW_HERO,
  type SharePreviewState,
} from '@/app/app/[tenantSlug]/products/products-page-state';

export function buildDemoSharePreview(tenantSlug: string): SharePreviewState {
  return {
    ...buildFallbackSharePreview(tenantSlug),
    feedTitle: '蛋龟图鉴 · 公开分享',
    feedSubtitle: '长期专注蛋龟繁育与选育记录',
  };
}

export function buildFallbackSharePreview(tenantSlug: string): SharePreviewState {
  const tenantName = tenantSlug.trim() || '租户';
  return {
    feedTitle: `${tenantName} · 公开图鉴`,
    feedSubtitle: '管理端顶部已切换为分享端视觉，可直接预览分享配置效果。',
    brandPrimary: '#FFD400',
    brandSecondary: '#1f2937',
    heroImages: [DEFAULT_SHARE_PREVIEW_HERO],
  };
}

export function buildSharePreviewFromPresentation(
  presentation: TenantSharePresentation,
  tenantSlug: string,
): SharePreviewState {
  const fallback = buildFallbackSharePreview(tenantSlug);
  const heroImages = presentation.heroImages
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return {
    feedTitle: normalizeNonEmptyText(presentation.feedTitle) ?? fallback.feedTitle,
    feedSubtitle: normalizeNonEmptyText(presentation.feedSubtitle) ?? fallback.feedSubtitle,
    brandPrimary: normalizeHexColor(presentation.brandPrimary) ?? fallback.brandPrimary,
    brandSecondary: normalizeHexColor(presentation.brandSecondary) ?? fallback.brandSecondary,
    heroImages: heroImages.length > 0 ? heroImages : fallback.heroImages,
  };
}

function normalizeNonEmptyText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function normalizeHexColor(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return null;
  }

  const validHex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  return validHex.test(normalized) ? normalized : null;
}

export function hexToRgba(color: string, alpha: number): string {
  const normalized = normalizeHexColor(color);
  if (!normalized) {
    return `rgba(31,41,55,${alpha})`;
  }

  const hex =
    normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  return `rgba(${red},${green},${blue},${alpha})`;
}
