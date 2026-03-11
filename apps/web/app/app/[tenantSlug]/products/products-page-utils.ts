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
  status: string;
  sortBy: ProductSortBy;
  sortDir: ProductSortDir;
};

type SeriesOptionLike = {
  id: string;
  code: string;
  name: string;
};

function isPlaceholderSeriesCode(code: string) {
  const normalized = normalizeText(code);
  return normalized === 'new-series' || normalized === 'new';
}

function isGeneratedSeriesCode(code: string) {
  const normalized = normalizeText(code);
  if (normalized.startsWith('legacy-series-')) {
    return true;
  }
  return /^series-[a-f0-9]{8,}$/.test(normalized);
}

function containsCjkCharacter(value: string) {
  return /[㐀-鿿]/.test(value);
}

function isAsciiSeriesCode(value: string) {
  return /^[A-Z0-9_-]+$/i.test(value);
}

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export const DEFAULT_LIST_QUERY: ProductsListQuery = {
  page: 1,
  pageSize: 20,
  search: '',
  sex: '',
  seriesId: '',
  status: '',
  // Default ordering: female -> male; then numeric code 1..100; "unsortable" codes treated as new uploads.
  sortBy: 'code',
  sortDir: 'asc',
};

export function parseListQuery(queryString: string): ProductsListQuery {
  const query = new URLSearchParams(queryString);
  const page = parsePositiveInt(query.get('page'), DEFAULT_LIST_QUERY.page);
  const pageSize = parsePageSize(query.get('pageSize'));

  const sortBy = query.get('sortBy') === 'updatedAt' ? 'updatedAt' : 'code';
  const sortDir = query.get('sortDir') === 'desc' ? 'desc' : 'asc';

  return {
    page,
    pageSize,
    search: (query.get('search') ?? '').trim(),
    sex: (query.get('sex') ?? '').trim(),
    seriesId: (query.get('seriesId') ?? '').trim(),
    status: (query.get('status') ?? '').trim(),
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
  if (sortBy === 'code') {
    return compareProductsByDefaultOrder(left, right, sortDir);
  }

  const factor = sortDir === 'asc' ? 1 : -1;
  const leftValue = Date.parse(left.updatedAt ?? '');
  const rightValue = Date.parse(right.updatedAt ?? '');
  return (leftValue - rightValue) * factor;
}

function compareProductsByDefaultOrder(
  left: Product,
  right: Product,
  sortDir: ProductSortDir,
): number {
  const leftPinned = isPinnedNewUploadCode(left.code);
  const rightPinned = isPinnedNewUploadCode(right.code);

  // Codes with Chinese characters are treated as new uploads and pinned to top.
  if (leftPinned && !rightPinned) {
    return -1;
  }
  if (!leftPinned && rightPinned) {
    return 1;
  }

  const leftOrder = parseProductOrder(left.code);
  const rightOrder = parseProductOrder(right.code);

  const leftSexRank = getSexRank(left.sex);
  const rightSexRank = getSexRank(right.sex);
  if (leftSexRank !== rightSexRank) {
    return leftSexRank - rightSexRank;
  }

  // If both have no 1..100 order number, fall back to natural code compare.
  if (leftOrder === null && rightOrder === null) {
    return left.code.localeCompare(right.code, 'zh-CN') * (sortDir === 'asc' ? 1 : -1);
  }

  // Items without numeric order come after numeric ones (unless pinned above).
  if (leftOrder === null && rightOrder !== null) {
    return 1;
  }
  if (leftOrder !== null && rightOrder === null) {
    return -1;
  }

  const factor = sortDir === 'asc' ? 1 : -1;
  const leftOrderValue = leftOrder ?? 0;
  const rightOrderValue = rightOrder ?? 0;

  if (leftOrderValue !== rightOrderValue) {
    return (leftOrderValue - rightOrderValue) * factor;
  }

  return left.code.localeCompare(right.code, 'zh-CN') * factor;
}

function isPinnedNewUploadCode(code: string | null | undefined): boolean {
  const trimmed = (code ?? '').trim();
  if (!trimmed) {
    return false;
  }

  return /[\u4e00-\u9fff]/.test(trimmed);
}

function parseProductOrder(code: string | null | undefined): number | null {
  const trimmed = (code ?? '').trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/\d+/);
  if (!match) {
    return null;
  }

  const value = Number(match[0]);
  if (!Number.isFinite(value) || value < 1 || value > 100) {
    return null;
  }

  return value;
}

function getSexRank(value: string | null | undefined): number {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'female') {
    return 0;
  }
  if (normalized === 'male') {
    return 1;
  }
  return 2;
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

  const displayName = matched.name.trim();
  const displayCode = matched.code.trim();
  if (!displayName) {
    return displayCode || seriesId;
  }

  if (!displayCode || isPlaceholderSeriesCode(displayCode) || isGeneratedSeriesCode(displayCode)) {
    return displayName;
  }

  if (normalizeText(displayName) === normalizeText(displayCode)) {
    return displayName;
  }

  if (containsCjkCharacter(displayName) && isAsciiSeriesCode(displayCode)) {
    return displayName;
  }

  return `${displayName}（${displayCode}）`;
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
