import type {
  PublicShareDetail,
  PublicShareDetailEvent,
  PublicShareFeedItem,
  PublicShareResponse
} from '@eggturtle/shared';

import type { Breeder, BreederEventItem, FamilyTree, MaleMateLoadItem, Series, Sex } from './types';

type TenantFeedShare = PublicShareResponse;
type TenantFeedDetail = NonNullable<TenantFeedShare['product']>;

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

export function mapPublicProductToLegacyBreeder(product: TenantFeedDetail): Breeder {
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

export function mapPublicShareDetail(data: TenantFeedShare): {
  events: BreederEventItem[];
  familyTree: FamilyTree | null;
  maleMateLoad: MaleMateLoadItem[];
} {
  const detail = data.detail;

  if (!detail) {
    return {
      events: [],
      familyTree: null,
      maleMateLoad: []
    };
  }

  return {
    events: detail.events.map((event) => mapDetailEvent(event)),
    familyTree: mapDetailFamilyTree(detail),
    maleMateLoad: detail.maleMateLoad.map((item) => ({
      femaleId: item.femaleId,
      femaleCode: item.femaleCode,
      femaleMainImageUrl: item.femaleMainImageUrl ?? undefined,
      femaleThumbnailUrl: item.femaleThumbnailUrl ?? undefined,
      lastEggAt: item.lastEggAt,
      lastMatingWithThisMaleAt: item.lastMatingWithThisMaleAt,
      daysSinceEgg: typeof item.daysSinceEgg === 'number' ? item.daysSinceEgg : undefined,
      status: item.status,
      excludeFromBreeding: item.excludeFromBreeding
    }))
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

function mapDetailEvent(event: PublicShareDetailEvent): BreederEventItem {
  return {
    id: event.id,
    eventType: event.eventType,
    eventDate: event.eventDate,
    maleCode: event.maleCode ?? null,
    eggCount: typeof event.eggCount === 'number' ? event.eggCount : null,
    note: event.note ?? null,
    oldMateCode: event.oldMateCode ?? null,
    newMateCode: event.newMateCode ?? null
  };
}

function mapDetailFamilyTree(detail: PublicShareDetail): FamilyTree | null {
  const tree = detail.familyTree;
  if (!tree) {
    return null;
  }

  const self = toFamilyTreeNode(tree.self);

  return {
    current: self,
    currentMate: tree.mate ? { id: tree.mate.id, code: tree.mate.code } : null,
    ancestors: {
      father: toFamilyTreeNodeOrUndefined(tree.sire),
      mother: toFamilyTreeNodeOrUndefined(tree.dam),
      paternalGrandfather: undefined,
      paternalGrandmother: undefined,
      maternalGrandfather: undefined,
      maternalGrandmother: undefined
    },
    offspring: tree.children.map((item) => toFamilyTreeNode(item)),
    siblings: []
  };
}

function toFamilyTreeNode(node: {
  id: string;
  code: string;
  name: string | null;
  sex: string | null;
}) {
  return {
    id: node.id,
    code: node.code,
    name: node.name ?? node.code,
    sex: normalizeSex(node.sex),
    thumbnailUrl: undefined
  };
}

function toFamilyTreeNodeOrUndefined(
  node:
    | {
        id: string;
        code: string;
        name: string | null;
        sex: string | null;
      }
    | null
): ReturnType<typeof toFamilyTreeNode> | undefined {
  if (!node) {
    return undefined;
  }

  return toFamilyTreeNode(node);
}
