import type { ProductImage } from '@eggturtle/shared';

import { resolveAuthenticatedAssetUrl } from '@/lib/api-client';

export type PendingImageItem = {
  id: string;
  file: File;
  previewUrl: string;
  isMain: boolean;
  localOrder: number;
};

export function normalizePendingImages(items: PendingImageItem[]): PendingImageItem[] {
  return items.map((item, index) => ({
    ...item,
    localOrder: index,
  }));
}

export function createLocalImageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `local-image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function releasePendingImageUrls(items: PendingImageItem[]) {
  items.forEach((item) => {
    URL.revokeObjectURL(item.previewUrl);
  });
}

export function resolveDrawerImageUrl(value: string) {
  return resolveAuthenticatedAssetUrl(value);
}

export function createDemoDrawerImages(productId: string): ProductImage[] {
  const nowIso = new Date().toISOString();

  return [
    {
      id: `${productId}-demo-1`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-1`,
      url: '/images/mg_01.jpg',
      contentType: 'image/jpeg',
      sizeBytes: '204800',
      sortOrder: 0,
      isMain: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${productId}-demo-2`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-2`,
      url: '/images/mg_02.jpg',
      contentType: 'image/jpeg',
      sizeBytes: '189440',
      sortOrder: 1,
      isMain: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: `${productId}-demo-3`,
      tenantId: 'demo-tenant',
      productId,
      key: `${productId}/demo-3`,
      url: '/images/mg_03.jpg',
      contentType: 'image/jpeg',
      sizeBytes: '176128',
      sortOrder: 2,
      isMain: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}
