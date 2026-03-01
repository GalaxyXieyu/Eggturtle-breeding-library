import type { PublicShareFeedItem, PublicShareResponse } from '@eggturtle/shared';

import type { Breeder, Series, Sex } from './types';

type TenantFeedShare = Extract<PublicShareResponse, { resourceType: 'tenant_feed' }>;
type PublicProduct = Extract<PublicShareResponse, { resourceType: 'product' }>['product'];

const NO_SERIES_ID = '__no_series__';
const NO_SERIES_NAME = '未分组';

export function mapTenantFeedToLegacy(data: TenantFeedShare): { series: Series[]; breeders: Breeder[] } {
  const breeders = data.items.map((item) => mapFeedItemToBreeder(item));
  const series = buildSeriesFromItems(data.items);

  return {
    series,
    breeders
  };
}

export function mapPublicProductToLegacyBreeder(product: PublicProduct): Breeder {
  const images = product.images.map((image) => ({
    id: image.id,
    url: image.url,
    alt: product.name || product.code,
    type: image.isMain ? 'main' : 'gallery'
  }));

  return {
    id: product.id,
    code: product.code,
    name: product.name || product.code,
    description: product.description || undefined,
    seriesId: resolveSeriesKey(product.seriesId, product.code),
    sex: normalizeSex(product.sex),
    offspringUnitPrice: product.offspringUnitPrice ?? undefined,
    sireCode: product.sireCode || undefined,
    damCode: product.damCode || undefined,
    currentMateCode: product.mateCode || undefined,
    images: images.length > 0 ? images : [{ url: '/images/mg_01.jpg', type: 'main' }]
  };
}

function mapFeedItemToBreeder(item: PublicShareFeedItem): Breeder {
  const cover = item.coverImageUrl || '/images/mg_01.jpg';

  return {
    id: item.id,
    code: item.code,
    name: item.name || item.code,
    description: item.description || undefined,
    seriesId: resolveSeriesKey(item.seriesId, item.code),
    sex: normalizeSex(item.sex),
    offspringUnitPrice: item.offspringUnitPrice ?? undefined,
    images: [{ id: `${item.id}-cover`, url: cover, alt: item.name || item.code, type: 'main' }]
  };
}

function buildSeriesFromItems(items: PublicShareFeedItem[]): Series[] {
  const byId = new Map<string, Series>();

  for (const item of items) {
    const id = resolveSeriesKey(item.seriesId, item.code);
    if (byId.has(id)) {
      continue;
    }

    byId.set(id, {
      id,
      name: id === NO_SERIES_ID ? NO_SERIES_NAME : id
    });
  }

  return [...byId.values()];
}

function normalizeSeriesId(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    return NO_SERIES_ID;
  }

  return normalized;
}

function resolveSeriesKey(seriesId: string | null | undefined, code: string): string {
  const codePrefix = extractCodePrefix(code);
  if (codePrefix) {
    return codePrefix;
  }

  return normalizeSeriesId(seriesId);
}

function extractCodePrefix(code: string | null | undefined): string | null {
  const normalized = code?.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^([^-_/\\\s]+)/);
  return match?.[1]?.trim() || null;
}

function normalizeSex(value: string | null | undefined): Sex {
  if (value === 'male') {
    return 'male';
  }

  if (value === 'female') {
    return 'female';
  }

  return 'unknown';
}
