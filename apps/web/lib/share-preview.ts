import type { PublicSharePresentation } from '@eggturtle/shared';

export type SharePreviewProps = {
  title?: string | null;
  subtitle?: string | null;
  previewImageUrl?: string | null;
  posterImageUrls?: Array<string | null | undefined> | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  wechatId?: string | null;
};

export type ResolvedSharePreviewProps = {
  title: string;
  subtitle: string;
  previewImageUrl: string | null;
  posterImageUrls: string[];
  primaryColor: string | null;
  secondaryColor: string | null;
  wechatId: string | null;
};

const MAX_POSTER_IMAGES = 10;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function buildSharePreviewProps(
  input: SharePreviewProps | null | undefined,
  defaults: SharePreviewProps = {},
): ResolvedSharePreviewProps {
  const previewImageUrl =
    normalizeImageUrl(input?.previewImageUrl) ?? normalizeImageUrl(defaults.previewImageUrl);
  const posterImageUrls = Array.from(
    new Set(
      [
        previewImageUrl,
        ...normalizeImageUrls(input?.posterImageUrls),
        ...normalizeImageUrls(defaults.posterImageUrls),
      ].filter((item): item is string => Boolean(item)),
    ),
  ).slice(0, MAX_POSTER_IMAGES);

  return {
    title: normalizeText(input?.title) ?? normalizeText(defaults.title) ?? '',
    subtitle: normalizeText(input?.subtitle) ?? normalizeText(defaults.subtitle) ?? '',
    previewImageUrl: previewImageUrl ?? posterImageUrls[0] ?? null,
    posterImageUrls,
    primaryColor: normalizeHexColor(input?.primaryColor) ?? normalizeHexColor(defaults.primaryColor),
    secondaryColor:
      normalizeHexColor(input?.secondaryColor) ?? normalizeHexColor(defaults.secondaryColor),
    wechatId: normalizeText(input?.wechatId) ?? normalizeText(defaults.wechatId),
  };
}

export function buildPublicSharePreviewProps(
  presentation: PublicSharePresentation | null | undefined,
  overrides: SharePreviewProps = {},
): ResolvedSharePreviewProps {
  return buildSharePreviewProps(overrides, {
    title: presentation?.feedTitle,
    subtitle: presentation?.feedSubtitle,
    previewImageUrl: presentation?.hero.images[0] ?? null,
    posterImageUrls: presentation?.hero.images ?? [],
    primaryColor: presentation?.theme.brandPrimary,
    secondaryColor: presentation?.theme.brandSecondary,
    wechatId: presentation?.contact.showWechatBlock ? presentation.contact.wechatId : null,
  });
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function normalizeImageUrl(value: string | null | undefined): string | null {
  return normalizeText(value);
}

function normalizeImageUrls(values: Array<string | null | undefined> | null | undefined): string[] {
  return (values ?? []).map((item) => normalizeImageUrl(item)).filter((item): item is string => Boolean(item));
}

function normalizeHexColor(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}
