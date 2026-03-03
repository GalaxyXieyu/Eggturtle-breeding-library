import type { Product } from '@eggturtle/shared';

export type ProductSortBy = 'updatedAt' | 'code';
export type ProductSortDir = 'asc' | 'desc';
export type SortSelection = `${ProductSortBy}-${ProductSortDir}`;

export type ProductsListQuery = {
  page: number;
  pageSize: number;
  search: string;
  sex: string;
  seriesId: string;
  sortBy: ProductSortBy;
  sortDir: ProductSortDir;
};

type SeriesOptionLike = {
  id: string;
  code: string;
  name: string;
};

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export const DEFAULT_LIST_QUERY: ProductsListQuery = {
  page: 1,
  pageSize: 20,
  search: '',
  sex: '',
  seriesId: '',
  sortBy: 'updatedAt',
  sortDir: 'desc',
};

export function parseListQuery(queryString: string): ProductsListQuery {
  const query = new URLSearchParams(queryString);
  const page = parsePositiveInt(query.get('page'), DEFAULT_LIST_QUERY.page);
  const pageSize = parsePageSize(query.get('pageSize'));

  const sortBy = query.get('sortBy') === 'code' ? 'code' : 'updatedAt';
  const sortDir = query.get('sortDir') === 'asc' ? 'asc' : 'desc';

  return {
    page,
    pageSize,
    search: (query.get('search') ?? '').trim(),
    sex: (query.get('sex') ?? '').trim(),
    seriesId: (query.get('seriesId') ?? '').trim(),
    sortBy,
    sortDir,
  };
}

export function toSortSelection(sortBy: ProductSortBy, sortDir: ProductSortDir): SortSelection {
  return `${sortBy}-${sortDir}`;
}

export function parseSortSelection(value: SortSelection): [ProductSortBy, ProductSortDir] {
  return value.split('-') as [ProductSortBy, ProductSortDir];
}

export function compareProducts(
  left: Product,
  right: Product,
  sortBy: ProductSortBy,
  sortDir: ProductSortDir,
): number {
  const factor = sortDir === 'asc' ? 1 : -1;

  if (sortBy === 'code') {
    return left.code.localeCompare(right.code, 'zh-CN') * factor;
  }

  const leftValue = Date.parse(left.updatedAt ?? '');
  const rightValue = Date.parse(right.updatedAt ?? '');
  return (leftValue - rightValue) * factor;
}

export function findSeriesByInput(
  input: string,
  options: SeriesOptionLike[],
): SeriesOptionLike | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  const normalizedInput = normalizeText(trimmedInput);

  const codeMatched = options.find((item) => normalizeText(item.code) === normalizedInput);
  if (codeMatched) {
    return codeMatched;
  }

  const nameMatched = options.find((item) => normalizeText(item.name) === normalizedInput);
  if (nameMatched) {
    return nameMatched;
  }

  const idMatched = options.find((item) => normalizeText(item.id) === normalizedInput);
  if (idMatched) {
    return idMatched;
  }

  return null;
}

export function formatSeriesLabelById(seriesId: string, options: SeriesOptionLike[]) {
  const matched = options.find((item) => item.id === seriesId);
  if (!matched) {
    return seriesId;
  }

  return `${matched.name}（${matched.code}）`;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  if (PAGE_SIZE_OPTIONS.some((option) => option === parsed)) {
    return parsed;
  }

  return DEFAULT_LIST_QUERY.pageSize;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}
