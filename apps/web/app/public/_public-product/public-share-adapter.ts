import type {
  PublicShareDetail,
  PublicShareDetailEvent,
  PublicShareFeedItem,
  PublicShareResponse,
} from '@eggturtle/shared';

import type {
  Breeder,
  BreederEventItem,
  FamilyTree,
  FamilyTreeMateNode,
  MaleMateLoadItem,
  Series,
  Sex,
} from '@/app/public/_public-product/types';

type TenantFeedShare = PublicShareResponse;
type TenantFeedDetail = NonNullable<TenantFeedShare['product']>;

const NO_SERIES_ID = '__no_series__';
const NO_SERIES_NAME = '未分组';

export function mapTenantFeedToLegacy(data: TenantFeedShare): {
  series: Series[];
  breeders: Breeder[];
} {
  const breeders = data.items.map((item) => mapFeedItemToBreeder(item));
  const series = buildSeriesFromItems(data.items);

  return {
    series,
    breeders,
  };
}

export function mapPublicProductToLegacyBreeder(product: TenantFeedDetail): Breeder {
  const images = product.images.map((image) => ({
    id: image.id,
    url: image.url,
    alt: product.name || product.code,
    type: image.isMain ? 'main' : 'gallery',
  }));

  return {
    id: product.id,
    code: product.code,
    name: product.name || product.code,
    description: product.description || undefined,
    seriesId: resolveSeriesKey(product.seriesId),
    sex: normalizeSex(product.sex),
    offspringUnitPrice: product.offspringUnitPrice ?? undefined,
    sireCode: product.sireCode || undefined,
    damCode: product.damCode || undefined,
    currentMateCode: product.mateCode || undefined,
    images: images.length > 0 ? images : [{ url: '/images/mg_01.jpg', type: 'main' }],
  };
}

export function mapPublicShareDetail(data: TenantFeedShare): {
  events: BreederEventItem[];
  familyTree: FamilyTree | null;
  maleMateLoad: MaleMateLoadItem[];
} {
  const detail = data.detail;
  const coverImageByProductId = buildCoverImageLookup(data.items);

  if (!detail) {
    return {
      events: [],
      familyTree: null,
      maleMateLoad: [],
    };
  }

  return {
    events: detail.events.map((event) => mapDetailEvent(event)),
    familyTree: mapDetailFamilyTree(detail, coverImageByProductId),
    maleMateLoad: detail.maleMateLoad.map((item) => ({
      femaleId: item.femaleId,
      femaleCode: item.femaleCode,
      femaleMainImageUrl: item.femaleMainImageUrl ?? undefined,
      femaleThumbnailUrl: item.femaleThumbnailUrl ?? undefined,
      lastEggAt: item.lastEggAt,
      lastMatingWithThisMaleAt: item.lastMatingWithThisMaleAt,
      daysSinceEgg: typeof item.daysSinceEgg === 'number' ? item.daysSinceEgg : undefined,
      status: item.status,
      excludeFromBreeding: item.excludeFromBreeding,
    })),
  };
}

function mapFeedItemToBreeder(item: PublicShareFeedItem): Breeder {
  const cover = item.coverImageUrl || '/images/mg_01.jpg';

  return {
    id: item.id,
    code: item.code,
    name: item.name || item.code,
    description: item.description || undefined,
    seriesId: resolveSeriesKey(item.seriesId),
    sex: normalizeSex(item.sex),
    needMatingStatus: item.needMatingStatus ?? undefined,
    lastEggAt: item.lastEggAt ?? undefined,
    lastMatingAt: item.lastMatingAt ?? undefined,
    daysSinceEgg: typeof item.daysSinceEgg === 'number' ? item.daysSinceEgg : undefined,
    offspringUnitPrice: item.offspringUnitPrice ?? undefined,
    images: [{ id: `${item.id}-cover`, url: cover, alt: item.name || item.code, type: 'main' }],
  };
}

function buildSeriesFromItems(items: PublicShareFeedItem[]): Series[] {
  const byId = new Map<string, Series>();

  for (const item of items) {
    const id = resolveSeriesKey(item.seriesId);
    const description = item.seriesDescription?.trim() || undefined;
    const existing = byId.get(id);

    if (existing) {
      if (!existing.description && description) {
        existing.description = description;
      }
      continue;
    }

    const code = item.seriesCode?.trim() || undefined;
    const name =
      item.seriesName?.trim() || code || (id === NO_SERIES_ID ? NO_SERIES_NAME : '未命名系列');

    byId.set(id, {
      id,
      code,
      name,
      description,
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

function resolveSeriesKey(seriesId: string | null | undefined): string {
  return normalizeSeriesId(seriesId);
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
    newMateCode: event.newMateCode ?? null,
  };
}

function buildCoverImageLookup(items: PublicShareFeedItem[]): Map<string, string | undefined> {
  const lookup = new Map<string, string | undefined>();

  for (const item of items) {
    lookup.set(item.id, item.coverImageUrl ?? undefined);
  }

  return lookup;
}

function mapDetailFamilyTree(
  detail: PublicShareDetail,
  coverImageByProductId: Map<string, string | undefined>,
): FamilyTree | null {
  const tree = detail.familyTree;
  if (!tree) {
    return null;
  }

  const self = toFamilyTreeNode(tree.self, coverImageByProductId);

  return {
    current: self,
    currentMate: tree.mate ? toFamilyTreeMateNode(tree.mate, coverImageByProductId) : null,
    mates: resolveFamilyTreeMates(tree, coverImageByProductId),
    ancestors: {
      father: toFamilyTreeNodeOrUndefined(tree.sire, coverImageByProductId),
      mother: toFamilyTreeNodeOrUndefined(tree.dam, coverImageByProductId),
      paternalGrandfather: undefined,
      paternalGrandmother: undefined,
      maternalGrandfather: undefined,
      maternalGrandmother: undefined,
    },
    offspring: tree.children.map((item) => toFamilyTreeNode(item, coverImageByProductId)),
    siblings: [],
    limitations: tree.limitations,
  };
}

function resolveFamilyTreeMates(
  tree: NonNullable<PublicShareDetail['familyTree']>,
  coverImageByProductId: Map<string, string | undefined>,
): FamilyTreeMateNode[] {
  if (tree.mates.length > 0) {
    return tree.mates.map((mate) => toFamilyTreeMateNode(mate, coverImageByProductId));
  }

  if (tree.mate) {
    return [toFamilyTreeMateNode(tree.mate, coverImageByProductId)];
  }

  return [];
}

function toFamilyTreeMateNode(
  node: {
    id: string;
    code: string;
    name: string | null;
    sex: string | null;
    coverImageUrl?: string | null;
    needMatingStatus?: 'normal' | 'need_mating' | 'warning' | null;
    lastEggAt?: string | null;
    lastMatingAt?: string | null;
    daysSinceEgg?: number | null;
  },
  coverImageByProductId: Map<string, string | undefined>,
): FamilyTreeMateNode {
  return {
    ...toFamilyTreeNode(node, coverImageByProductId),
    needMatingStatus: node.needMatingStatus ?? undefined,
    lastEggAt: node.lastEggAt ?? undefined,
    lastMatingAt: node.lastMatingAt ?? undefined,
    daysSinceEgg: typeof node.daysSinceEgg === 'number' ? node.daysSinceEgg : undefined,
  };
}

function toFamilyTreeNode(
  node: {
    id: string;
    code: string;
    name: string | null;
    sex: string | null;
    coverImageUrl?: string | null;
  },
  coverImageByProductId: Map<string, string | undefined>,
) {
  return {
    id: node.id,
    code: node.code,
    name: node.name ?? node.code,
    sex: normalizeSex(node.sex),
    thumbnailUrl: node.coverImageUrl ?? coverImageByProductId.get(node.id),
  };
}

function toFamilyTreeNodeOrUndefined(
  node: {
    id: string;
    code: string;
    name: string | null;
    sex: string | null;
    coverImageUrl?: string | null;
  } | null,
  coverImageByProductId: Map<string, string | undefined>,
): ReturnType<typeof toFamilyTreeNode> | undefined {
  if (!node) {
    return undefined;
  }

  return toFamilyTreeNode(node, coverImageByProductId);
}
