import type { Product, ProductListStats } from '@eggturtle/shared';

import { EMPTY_LIST_STATS } from '@/app/app/[tenantSlug]/products/products-page-state';

export function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function appendUniqueProducts(currentItems: Product[], nextItems: Product[]) {
  const existingIds = new Set(currentItems.map((item) => item.id));
  const merged = [...currentItems];
  for (const item of nextItems) {
    if (existingIds.has(item.id)) {
      continue;
    }
    existingIds.add(item.id);
    merged.push(item);
  }
  return merged;
}

export function buildStatsFromProducts(items: Product[]): ProductListStats {
  const stats = {
    ...EMPTY_LIST_STATS,
  };

  for (const item of items) {
    const normalizedSex = normalizeText(item.sex);
    if (normalizedSex === 'male') {
      stats.maleCount += 1;
    } else if (normalizedSex === 'female') {
      stats.femaleCount += 1;
    } else {
      stats.unknownCount += 1;
    }

    if (item.needMatingStatus === 'need_mating') {
      stats.needMatingCount += 1;
    } else if (item.needMatingStatus === 'warning') {
      stats.warningCount += 1;
    }
  }

  return stats;
}
