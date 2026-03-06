import type { Product, ProductListStats } from '@eggturtle/shared';

import { DEFAULT_LIST_QUERY } from '@/app/app/[tenantSlug]/products/products-page-utils';

export type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SharePreviewState = {
  feedTitle: string;
  feedSubtitle: string;
  brandPrimary: string;
  brandSecondary: string;
  heroImages: string[];
};

export type ProductsPagePayload = {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: ProductListStats;
};

export const DEFAULT_SHARE_PREVIEW_HERO = '/images/mg_04.jpg';

export const SEX_FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'female', label: '母' },
  { value: 'male', label: '公' },
  { value: 'unknown', label: '未知' },
] as const;

export const STATUS_FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'need_mating', label: '待配' },
  { value: 'warning', label: '⚠️逾期未交配' },
] as const;

export const DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-prod-01',
    tenantId: 'demo-tenant',
    code: 'ET-MG-01',
    type: 'breeder',
    name: '曼谷金头 01',
    description: '展示用示例产品',
    seriesId: 'MG',
    sex: 'female',
    needMatingStatus: 'need_mating',
    lastEggAt: '2026-02-19T00:00:00.000Z',
    lastMatingAt: '2026-01-29T00:00:00.000Z',
    daysSinceEgg: 12,
    offspringUnitPrice: 20000,
    coverImageUrl: '/images/mg_01.jpg',
    createdAt: '2026-02-28T07:10:00.000Z',
    updatedAt: '2026-02-28T09:20:00.000Z',
  },
  {
    id: 'demo-prod-02',
    tenantId: 'demo-tenant',
    code: 'ET-MG-02',
    type: 'breeder',
    name: '曼谷金头 02',
    description: '展示用示例产品',
    seriesId: 'MG',
    sex: 'male',
    needMatingStatus: 'normal',
    coverImageUrl: '/images/mg_02.jpg',
    createdAt: '2026-02-27T11:00:00.000Z',
    updatedAt: '2026-02-28T08:15:00.000Z',
  },
  {
    id: 'demo-prod-03',
    tenantId: 'demo-tenant',
    code: 'ET-MIX-03',
    type: 'breeder',
    name: '混系示例 03',
    description: '无封面示例',
    seriesId: null,
    sex: 'unknown',
    coverImageUrl: null,
    createdAt: '2026-02-25T03:00:00.000Z',
    updatedAt: '2026-02-26T12:45:00.000Z',
  },
];

export const LIST_PAGE_SIZE = DEFAULT_LIST_QUERY.pageSize;

export const EMPTY_LIST_STATS: ProductListStats = {
  maleCount: 0,
  femaleCount: 0,
  unknownCount: 0,
  yearEggCount: 0,
  needMatingCount: 0,
  warningCount: 0,
};
